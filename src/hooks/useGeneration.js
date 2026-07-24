import { useState, useRef, useCallback } from "react";
import { generateTripPlan } from "../lib/apiClient.js";
import {
  buildClientCreditSnapshot,
  buildGenerationPrepProgress,
  createInitialGenerationProgress,
  decrementCachedCreditStatus,
} from "../lib/planTripStream.js";
import { canStartTripGeneration, generationFailureMessage, isTripPlanComplete } from "../lib/generateTripFlow.js";
import { preloadGenerationStreamOverlay } from "../lib/preloadGenerationLoader.js";
import { buildFallbackTripData, parseTripApiResponse, stripSessionOnlyAnswers } from "../lib/tripHandlers.js";
import { persistAfterSuccessfulGeneration } from "../lib/postGenerationPersistence.js";
import { enrichGeneratedTrip, enrichPlacesLayer } from "../lib/tripEnrichment.js";
import { buildPlacesContext, formatPlacesContextForPrompt, shouldPrefetchPlacesContext } from "../lib/placesContext.js";
import { applySegmentContextToPlaces } from "../lib/applySegmentContext.js";
import { buildPlanSnapshot } from "../lib/planSnapshot.js";
import { formatRegenerateDiffBlock } from "../lib/planSnapshotDiff.js";
import { formatGenerationHints } from "../lib/tripConstraintsSummary.js";
import { formatActionTipsBlock } from "../lib/tripTips.js";
import { truckRestrictionsToTips, weighStationsToRoadStops } from "../lib/truckRoutingApi.js";
import { formatAnswerConfidenceNotes, buildQuestionLabelMap } from "../lib/answerIntent.js";
import {
  buildRecentTripsContext,
  resolveAnswersWithFallback,
  detectAnswerGaps,
  formatGracefulDegradationNotes,
  fetchUserTripPreferences,
  stripAnswersForSonnet,
} from "../lib/generationContext.js";
import {
  buildUserPatternSummary,
  buildRecentTripsPreferencesRollup,
  buildTravelerDossier,
} from "../lib/tripHistoryAnalysis.js";
import { formatStopRejectionsForPrompt } from "../lib/stopRejectionPreferences.js";
import { stopsToMapMarkers } from "../lib/mapMarkers.js";
import { getEffectiveVehicle, inferFuelType, isScenicRoute } from "../lib/vehicles.js";
import { normalizeTripAnswers } from "../lib/tripFlow.js";
import { buildContinuousDriveTip, isContinuousDrive } from "../lib/driveMode.js";
import { consolidateAndCapAlerts } from "../lib/tripAlerts.js";
import { clearPlanDraft as clearSavedPlanDraft } from "./usePlanDraft.js";
import { SIGNUP_GENERATE_LEAD } from "./useAppAuth.jsx";

/**
 * Trip generation / enrichment pipeline for App.
 * loading/generated stay in App (needed before map/share); setters injected.
 */
export function useGeneration({
  // early state owned by App
  loading,
  setLoading,
  generated,
  setGenerated,
  // auth / credits
  user,
  session,
  openAuthModal,
  creditStatus,
  creditStatusRef,
  applyCreditStatus,
  setCreditsNeedRefresh,
  openTripsUpgrade,
  userProfile,
  planPreferencesRef,
  savedTripsRef,
  prependSavedTrip,
  applyPlanPreferencesSaved,
  // map
  isLoaded,
  fetchDirections,
  routeInfo,
  setRouteInfo,
  originRef,
  destRef,
  origin,
  dest,
  setOrigin,
  setDest,
  setMapMarkers,
  getDepartureTime,
  // flow
  answers,
  setAnswers,
  convoComplete,
  setConvoComplete,
  setQIndex,
  setCurrentQuestion,
  questionHistory,
  answerChangeCountsRef,
  buildQuestionContext,
  timingMode,
  // trip result setters / state
  stops,
  setStops,
  roadStops,
  setRoadStops,
  setTripTips,
  setPersonalTouches,
  setChangesMade,
  customStops,
  selectedLodging,
  setSelectedLodging,
  setTripFormat,
  setRecommendations,
  recommendations,
  setActivitiesByCity,
  activitiesByCity,
  setRestaurantsByCity,
  restaurantsByCity,
  setWeatherByCity,
  setRouteOptimized,
  setOptionalStopCards,
  optionalStopCards,
  setTripLegs,
  setTripAlerts,
  setActiveDayIndex,
  setDismissedAlerts,
  setLastTripPreview,
  setResultsView,
  setTab,
  setCardCollapsed,
  setSavedPlanSnapshot,
  savedPlanSnapshot,
  currentPlanSnapshot,
  tripLegs,
  // sync / share
  itinerarySync,
  collaborationHintsRef,
  generateTripRef,
  toastFnRef,
  // helpers from App
  buildHeroTripPreview,
}) {
  const [enrichingTrip, setEnrichingTrip] = useState(false);
  const [enrichingPlaces, setEnrichingPlaces] = useState(false);
  const [enrichmentLimited, setEnrichmentLimited] = useState(false);
  const [enrichmentNoticeDismissed, setEnrichmentNoticeDismissed] = useState(false);
  const [generationStream, setGenerationStream] = useState(null);
  const [tripUsedFallback, setTripUsedFallback] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [dismissedActionTipIds, setDismissedActionTipIds] = useState([]);
  const actionTipHintsRef = useRef("");

  const generateAbortRef = useRef(null);
  const generateTripInFlightRef = useRef(false);
  const enrichAbortRef = useRef(null);
  const placesEnrichAbortRef = useRef(null);
  const placesEnrichmentPendingRef = useRef(false);
  const placesEnrichmentContextRef = useRef(null);

  function toast_(msg, options) {
    return toastFnRef.current?.(msg, options);
  }

  function cancelGenerateTrip() {
    generateAbortRef.current?.abort();
    enrichAbortRef.current?.abort();
  }

  function ensurePayoffScreen() {
    setConvoComplete(true);
    setQIndex(-2);
    setCurrentQuestion(null);
  }

  async function enrichAndSetTrip(parsedStops, parsedRoadStops, normalizedAnswers, routeInfoOverride = null, placesContextOverride = null) {
    const activeRouteInfo = routeInfoOverride ?? routeInfo;
    const mapsReady = isLoaded && !!window.google;
    enrichAbortRef.current?.abort();
    const enrichController = new AbortController();
    enrichAbortRef.current = enrichController;
    setEnrichingTrip(true);
    setEnrichmentLimited(false);
    try {
      const enriched = await enrichGeneratedTrip({
        answers: normalizedAnswers,
        routeInfo: activeRouteInfo,
        stops: parsedStops,
        roadStops: parsedRoadStops,
        customStops,
        selectedLodging,
        timingMode,
        departureTime: getDepartureTime(),
        origin: originRef.current?.value?.trim() || origin,
        destination: destRef.current?.value?.trim() || dest,
        mapsReady,
        signal: enrichController.signal,
        placesContext: placesContextOverride,
        deferPlacesEnrichment: true,
      });
      if (enrichController.signal.aborted) return null;
      placesEnrichmentContextRef.current = {
        answers: normalizedAnswers,
        routeInfo: activeRouteInfo,
        stops: enriched.stops,
        roadStops: enriched.roadStops,
        destination: destRef.current?.value?.trim() || dest,
        mapsReady,
      };
      placesEnrichmentPendingRef.current = Boolean(enriched.placesEnrichmentPending);
      setStops(enriched.stops);
      setRoadStops(enriched.roadStops);
      setActivitiesByCity(enriched.activitiesByCity);
      setRestaurantsByCity(enriched.restaurantsByCity || {});
      setWeatherByCity(enriched.weatherByCity || {});
      setRouteOptimized(enriched.routeOptimized || false);
      if (enriched.routeOptimized) {
        setRouteInfo(prev => (prev ? { ...prev, routeOptimized: true } : prev));
      }
      setOptionalStopCards(enriched.optionalStopCards || []);
      setTripAlerts(consolidateAndCapAlerts(enriched.tripAlerts));
      setActiveDayIndex(0);
      if (generated) {
        itinerarySync.initFromTrip({
          origin: originRef.current?.value?.trim() || origin,
          dest: destRef.current?.value?.trim() || dest,
          routeInfo: activeRouteInfo,
          stops: enriched.stops,
          roadStops: enriched.roadStops,
          answers: normalizedAnswers,
          departureTime: getDepartureTime(),
          optionalStopCards: enriched.optionalStopCards || [],
          activitiesByCity: enriched.activitiesByCity,
          restaurantsByCity: enriched.restaurantsByCity || {},
          recommendations,
        });
      } else {
        setMapMarkers(
          mapsReady
            ? enriched.mapMarkers
            : stopsToMapMarkers(enriched.stops, enriched.roadStops, customStops, [], answers),
        );
      }
      setDismissedAlerts([]);
      if (!mapsReady) setEnrichmentLimited(true);
      capturePlanSnapshot();
      return enriched;
    } catch (err) {
      if (err.name === "AbortError") return null;
      console.warn("Trip enrichment failed:", err);
      setEnrichmentLimited(true);
      setMapMarkers(stopsToMapMarkers(parsedStops, parsedRoadStops, customStops, [], answers));
      return null;
    } finally {
      if (enrichAbortRef.current === enrichController) {
        enrichAbortRef.current = null;
      }
      setEnrichingTrip(false);
    }
  }

  function cancelEnrichment() {
    enrichAbortRef.current?.abort();
    placesEnrichAbortRef.current?.abort();
    placesEnrichmentPendingRef.current = false;
    setEnrichingPlaces(false);
    setEnrichingTrip(false);
    toast_("Enrichment cancelled — basic trip data is still shown.");
  }

  const runPlacesEnrichment = useCallback(async () => {
    if (!placesEnrichmentPendingRef.current || !placesEnrichmentContextRef.current) return;
    placesEnrichmentPendingRef.current = false;
    placesEnrichAbortRef.current?.abort();
    const controller = new AbortController();
    placesEnrichAbortRef.current = controller;
    setEnrichingPlaces(true);
    try {
      const ctx = placesEnrichmentContextRef.current;
      const layer = await enrichPlacesLayer({
        ...ctx,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setActivitiesByCity(layer.activitiesByCity || {});
      setRestaurantsByCity(layer.restaurantsByCity || {});
      setOptionalStopCards(layer.optionalStopCards || []);
      if (layer.roadStops?.length) setRoadStops(layer.roadStops);
      if (layer.poiMarkers?.length && isLoaded && window.google) {
        setMapMarkers(stopsToMapMarkers(
          ctx.stops,
          layer.roadStops || ctx.roadStops,
          customStops,
          layer.poiMarkers,
          ctx.answers,
        ));
      }
    } catch (err) {
      if (err.name !== "AbortError") console.warn("Places enrichment failed:", err);
    } finally {
      if (placesEnrichAbortRef.current === controller) {
        placesEnrichAbortRef.current = null;
      }
      setEnrichingPlaces(false);
    }
  }, [customStops, isLoaded]);

  function capturePlanSnapshot() {
    const snapshot = buildPlanSnapshot({
      origin: originRef.current?.value?.trim() || origin,
      dest: destRef.current?.value?.trim() || dest,
      answers,
      routeInfo,
    });
    setSavedPlanSnapshot(snapshot);
    return snapshot;
  }

  function handleDismissActionTip(id) {
    setDismissedActionTipIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }

  function handleAcceptActionTip(tip) {
    actionTipHintsRef.current = formatActionTipsBlock([tip]);
    void generateTrip();
  }

  async function generateTrip(options = {}) {
    const tripOrigin = originRef.current?.value?.trim() || origin;
    const tripDest = destRef.current?.value?.trim() || dest;

    if (!user) {
      openAuthModal("signup", { lead: SIGNUP_GENERATE_LEAD });
      return;
    }

    const status = creditStatusRef.current || creditStatus;

    const guard = canStartTripGeneration({
      inFlight: generateTripInFlightRef.current,
      origin: tripOrigin,
      dest: tripDest,
      convoComplete: Boolean(options.fromDraft) || convoComplete,
      creditsRemaining: status?.remaining,
      unlimited: status?.unlimited,
    });

    if (!guard.ok) {
      if (guard.reason === "in_flight") return;
      if (guard.reason === "missing_route") {
        toast_("Enter origin and destination first");
        return;
      }
      if (guard.reason === "incomplete_questions") {
        toast_("Finish the trip questions first, then generate your plan.");
        return;
      }
      if (guard.reason === "no_credits") {
        openTripsUpgrade({ limitReached: status?.billingPeriod === "monthly", resetDate: status?.resetDate });
        return;
      }
    }

    void preloadGenerationStreamOverlay();

    setOrigin(tripOrigin);
    setDest(tripDest);
    setGenerationStream(createInitialGenerationProgress({
      cityNames: routeInfo?.citiesAlongRoute || [],
      routeSummary: routeInfo?.distance
        ? `${tripOrigin?.split(",")[0]?.trim() || tripOrigin} to ${tripDest?.split(",")[0]?.trim() || tripDest}`
        : null,
    }));
    setLoading(true);
    setEnrichmentLimited(false);
    setEnrichmentNoticeDismissed(false);
    setTripUsedFallback(false);
    setGenerationError(null);
    generateTripInFlightRef.current = true;

    const generateController = new AbortController();
    generateAbortRef.current = generateController;

    let normalizedAnswers = normalizeTripAnswers(answers, buildQuestionContext(answers), { forGeneration: true });

    const applyGeneratedTrip = (parsed, activeRouteInfo, { tips, mergedRoadStops, placesContext: ctxForEnrichment }) => {
      if (activeRouteInfo) {
        setRouteInfo(prev => ({ ...(prev || {}), ...activeRouteInfo }));
      }
      setStops(parsed.stops);
      setRoadStops(mergedRoadStops);
      setTripTips(tips);
      actionTipHintsRef.current = "";
      setDismissedActionTipIds([]);
      setPersonalTouches(parsed.personalTouches || []);
      setChangesMade(parsed.changesMade || []);
      setTripFormat(parsed.tripFormat || null);
      setRecommendations(parsed.recommendations || []);
      setGenerated(true);
      const heroPreview = buildHeroTripPreview(parsed.stops, mergedRoadStops, normalizedAnswers);
      if (heroPreview) setLastTripPreview(heroPreview);
      setResultsView("itinerary");
      setTab("plan");
      setCardCollapsed(false);
      itinerarySync.initFromTrip({
        origin: tripOrigin,
        dest: tripDest,
        routeInfo: activeRouteInfo,
        stops: parsed.stops,
        roadStops: mergedRoadStops,
        answers: normalizedAnswers,
        departureTime: getDepartureTime(),
        optionalStopCards,
        activitiesByCity,
        restaurantsByCity,
        recommendations: parsed.recommendations || [],
      });
      void enrichAndSetTrip(parsed.stops, mergedRoadStops, normalizedAnswers, activeRouteInfo, ctxForEnrichment);
      clearSavedPlanDraft();
      toast_("Trip planned", true);
    };

    try {
      let routeSnapshot = routeInfo;
      const hasRoute = Boolean(routeSnapshot?.distance && routeSnapshot?.routePoints?.length);
      if (isLoaded && window.google && !hasRoute) {
        setGenerationStream(buildGenerationPrepProgress("routing", {
          cityNames: routeSnapshot?.citiesAlongRoute || [],
        }));
        const routeResult = await fetchDirections(getEffectiveVehicle(answers));
        if (!routeResult?.ok) {
          toast_("Route could not be calculated — trip planning may be limited.", { isError: true });
        } else if (routeResult.routeInfo) {
          routeSnapshot = routeResult.routeInfo;
        }
      }

      if (generateController.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      normalizedAnswers = normalizeTripAnswers(answers, buildQuestionContext(answers), { forGeneration: true });

      const userPrefs = user && session?.access_token
        ? await fetchUserTripPreferences(session.access_token)
        : null;
      normalizedAnswers = resolveAnswersWithFallback(normalizedAnswers, userPrefs, {
        planPrefs: planPreferencesRef.current,
        travelerProfile: userProfile?.traveler_profile,
      });
      normalizedAnswers = stripAnswersForSonnet(normalizedAnswers);
      const answerGaps = detectAnswerGaps(normalizedAnswers);
      const tripsForContext = user ? savedTripsRef : [];
      const recentTripsContext = buildRecentTripsContext(tripsForContext, 3);
      const userTravelPatterns = buildUserPatternSummary(tripsForContext);
      const recentTripsPreferencesRollup = buildRecentTripsPreferencesRollup(tripsForContext, 3);
      const travelerDossier = buildTravelerDossier(tripsForContext, normalizedAnswers);
      const stopRejectionsContext = formatStopRejectionsForPrompt(
        planPreferencesRef.current?.stop_rejections,
      );
      const answerConfidenceNotes = formatAnswerConfidenceNotes(
        answerChangeCountsRef.current,
        buildQuestionLabelMap(questionHistory),
      );
      const gracefulDegradationNotes = formatGracefulDegradationNotes(
        normalizedAnswers,
        userPrefs,
        answerGaps,
        user ? savedTripsRef.current.length : null,
      );

      const activeRouteInfo = {
        ...(routeSnapshot || {}),
        origin: tripOrigin,
        destination: tripDest,
        scenic: isScenicRoute(answers),
      };

      let placesContext = null;
      let placesContextPrompt = "";
      if (isLoaded && window.google && activeRouteInfo.routePoints?.length
        && shouldPrefetchPlacesContext(normalizedAnswers, activeRouteInfo)) {
        setGenerationStream(buildGenerationPrepProgress("places", {
          cityNames: activeRouteInfo.citiesAlongRoute || [],
        }));
        try {
          placesContext = await buildPlacesContext(normalizedAnswers, activeRouteInfo);
          try {
            // Context scoring is per-trip — applied at read/generation time, never into corridor caches.
            placesContext = await applySegmentContextToPlaces(placesContext, activeRouteInfo, {
              departureTime: typeof getDepartureTime === "function" ? getDepartureTime() : new Date(),
              answers: normalizedAnswers,
            });
          } catch (ctxErr) {
            console.warn("segment context skipped — generation continues:", ctxErr?.message);
          }
          placesContextPrompt = formatPlacesContextForPrompt(placesContext);
        } catch (placesErr) {
          console.warn("places context failed — continuing without:", placesErr?.message);
          placesContext = null;
          placesContextPrompt = "";
        }
      }

      const planPayload = {
        origin: tripOrigin,
        destination: tripDest,
        answers: {
          ...normalizedAnswers,
          fuel: inferFuelType(normalizedAnswers, normalizedAnswers.preferences || [], normalizedAnswers),
        },
        routeInfo: activeRouteInfo,
        placesContext,
        placesContextPrompt,
        generationHints: formatGenerationHints(
          normalizedAnswers,
          activeRouteInfo,
          {
            regenerateDiffBlock: savedPlanSnapshot
              ? formatRegenerateDiffBlock(savedPlanSnapshot, currentPlanSnapshot)
              : "",
            collaborationHintsBlock: collaborationHintsRef.current || "",
            actionTipHintsBlock: actionTipHintsRef.current || "",
          },
        ),
        recentTripsContext,
        recentTripsPreferencesRollup,
        travelerDossier,
        stopRejectionsContext,
        userTravelPatterns,
        answerConfidenceNotes,
        gracefulDegradationNotes,
        fallbackPreferences: userPrefs
          ? resolveAnswersWithFallback({}, userPrefs, {
            planPrefs: planPreferencesRef.current,
            travelerProfile: userProfile?.traveler_profile,
          })
          : undefined,
        legs: tripLegs.length > 0 ? tripLegs : undefined,
        model: "claude-sonnet-4-6",
        clientCreditStatus: user ? buildClientCreditSnapshot(creditStatusRef.current || creditStatus) : null,
      };

      setGenerationStream(buildGenerationPrepProgress("sending", {
        cityNames: activeRouteInfo.citiesAlongRoute || [],
      }));

      let lastErr = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const data = await generateTripPlan(
            planPayload,
            session?.access_token || null,
            {
              signal: generateController.signal,
              onStreamProgress: (progress) => {
                setGenerationStream(progress);
              },
            },
          );

          if (generateController.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          const parsed = parseTripApiResponse(data, normalizedAnswers, activeRouteInfo, buildFallbackTripData);
          if (!isTripPlanComplete(parsed)) {
            throw new Error("Trip planner returned incomplete results");
          }

          setGenerationError(null);
          setTripUsedFallback(Boolean(parsed.usedFallback));

          const restrictionTips = truckRestrictionsToTips(activeRouteInfo?.restrictions || []);
          const tips = [...restrictionTips, ...(parsed.tripTips || [])];
          if (isContinuousDrive(normalizedAnswers)) {
            tips.unshift(buildContinuousDriveTip(activeRouteInfo));
          }
          const weighStops = weighStationsToRoadStops(activeRouteInfo?.weighStations || []);
          const mergedRoadStops = [...(parsed.roadStops || [])];
          for (const ws of weighStops) {
            if (!mergedRoadStops.some(s => s.id === ws.id || (s.lat === ws.lat && s.lng === ws.lng))) {
              mergedRoadStops.push(ws);
            }
          }

          applyGeneratedTrip(parsed, activeRouteInfo, { tips, mergedRoadStops, placesContext });

          if (user && session?.access_token) {
            applyCreditStatus(decrementCachedCreditStatus(creditStatusRef.current || creditStatus));
            setCreditsNeedRefresh(n => n + 1);
            void persistAfterSuccessfulGeneration({
              userId: user.id,
              accessToken: session.access_token,
              tripPayload: {
                origin: tripOrigin,
                dest: tripDest,
                date: new Date().toLocaleDateString(),
                stops: parsed.stops,
                roadStops: mergedRoadStops,
                tripTips: tips,
                personalTouches: parsed.personalTouches || [],
                changesMade: parsed.changesMade || [],
                answers: stripSessionOnlyAnswers(normalizedAnswers),
                routeInfo: activeRouteInfo,
                selectedLodging,
              },
              normalizedAnswers,
              onTripSaved: prependSavedTrip,
              onPreferencesSaved: applyPlanPreferencesSaved,
            });
          }

          setGenerationStream({
            phase: "complete",
            fraction: 1,
            message: "Your trip is ready",
            cityNames: activeRouteInfo.citiesAlongRoute || [],
          });
          await new Promise(resolve => setTimeout(resolve, 520));
          return;
        } catch (err) {
          lastErr = err;
          if (err.name === "AbortError" || err.code === "no_credits" || err.code === "generation_timeout") throw err;
          if (attempt === 0) continue;
          throw lastErr;
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setGenerationError(null);
        ensurePayoffScreen();
        toast_("Trip generation cancelled.");
        return;
      }
      console.error("Generate trip error:", err);
      if (err.code === "rate_limited" || err.rateLimited) {
        const msg = generationFailureMessage(err);
        setGenerationError(msg);
        toast_(msg, { isError: true });
        ensurePayoffScreen();
        return;
      }
      if (err.code === "unauthenticated") {
        const msg = "Sign in to generate a trip plan.";
        setGenerationError(msg);
        toast_(msg, { isError: true });
        openAuthModal("signup", { lead: SIGNUP_GENERATE_LEAD });
        ensurePayoffScreen();
        return;
      }
      if (err.code === "no_credits") {
        const msg = generationFailureMessage(err);
        setGenerationError(msg);
        toast_(msg, { isError: true });
        openTripsUpgrade({
          limitReached: Boolean(err.limitReached) || err.credits?.billingPeriod === "monthly",
          resetDate: err.resetDate || err.credits?.resetDate,
        });
        if (err.credits) applyCreditStatus(err.credits);
        ensurePayoffScreen();
        return;
      }
      const msg = generationFailureMessage(err);
      setGenerationError(msg);
      ensurePayoffScreen();
      toast_(msg, { isError: true });
    } finally {
      generateTripInFlightRef.current = false;
      if (generateAbortRef.current === generateController) {
        generateAbortRef.current = null;
      }
      setGenerationStream(null);
      setLoading(false);
    }
  }
  generateTripRef.current = generateTrip;

  async function retryEnrichment() {
    if (!generated) return;
    const normalized = normalizeTripAnswers(answers, buildQuestionContext(answers), { forGeneration: true });
    setEnrichmentNoticeDismissed(false);
    await enrichAndSetTrip(stops, roadStops, normalized);
  }

  return {
    enrichingTrip,
    setEnrichingTrip,
    enrichingPlaces,
    setEnrichingPlaces,
    enrichmentLimited,
    setEnrichmentLimited,
    enrichmentNoticeDismissed,
    setEnrichmentNoticeDismissed,
    generationStream,
    setGenerationStream,
    tripUsedFallback,
    setTripUsedFallback,
    generationError,
    setGenerationError,
    dismissedActionTipIds,
    setDismissedActionTipIds,
    actionTipHintsRef,
    generateAbortRef,
    generateTripInFlightRef,
    enrichAbortRef,
    placesEnrichAbortRef,
    placesEnrichmentPendingRef,
    placesEnrichmentContextRef,
    cancelGenerateTrip,
    ensurePayoffScreen,
    enrichAndSetTrip,
    cancelEnrichment,
    runPlacesEnrichment,
    capturePlanSnapshot,
    handleDismissActionTip,
    handleAcceptActionTip,
    generateTrip,
    retryEnrichment,
  };
}
