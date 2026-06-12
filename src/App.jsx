/**
 * TripMappa root orchestrator (~710 lines).
 * State, effects, handlers, and layout only — logic lives in src/lib/, UI in src/components/.
 * See ROADMAP.md for phase status and conventions.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_LIBRARIES, LEG_MAP_STYLES, TRIP_ROUTE_GOLD } from "./lib/constants.js";
import { applyMapThemeStyles } from "./lib/mapStyles.js";
import {
  isTruckVehicle,
  isRvVehicle,
  hasPref,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
} from "./lib/vehicles.js";
import { getNextFlowQuestion, getFlowCompleteMessage, normalizeTripAnswers, getFlowProgress, isRouteContextReady, pruneStaleBranchAnswers, pruneRouteDependentAnswers, warnContinuousDriveFeasibility } from "./lib/tripFlow.js";
import { consumeGuestCredit, refundGuestCredit, getGuestCreditStatus } from "./lib/guestCredits.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./lib/parsing.js";
import { buildContinuousDriveTip, isContinuousDrive, OVERNIGHT_PREFERENCE_CONTINUOUS } from "./lib/driveMode.js";
import { generateTripPlan } from "./lib/apiClient.js";
import {
  buildClientCreditSnapshot,
  buildGenerationPrepProgress,
  createInitialGenerationProgress,
  decrementCachedCreditStatus,
} from "./lib/planTripStream.js";
import { canStartTripGeneration, generationFailureMessage, isTripPlanComplete } from "./lib/generateTripFlow.js";
import { preloadGenerationStreamOverlay, shouldPreloadGenerationLoader } from "./lib/preloadGenerationLoader.js";
import { buildFallbackTripData, parseTripApiResponse, stripSessionOnlyAnswers } from "./lib/tripHandlers.js";
import { persistAfterSuccessfulGeneration, writeBackPlanPreferencesSilently } from "./lib/postGenerationPersistence.js";
import { resolvePlaceFromAutocomplete } from "./lib/places.js";
import { enrichGeneratedTrip } from "./lib/tripEnrichment.js";
import { createItineraryShareLink, loadSharedItinerary } from "./lib/itineraryShare.js";
import { copyToClipboard } from "./lib/copyToClipboard.js";
import { buildPlacesContext, formatPlacesContextForPrompt } from "./lib/placesContext.js";
import { isTowingSelected, getTripBudgetCap, getFuelRangeMiles } from "./lib/tripAccommodations.js";
import { computeBudgetEstimate } from "./lib/budget.js";
import { stopsToMapMarkers } from "./lib/mapMarkers.js";
import { useItinerarySync } from "./hooks/useItinerarySync.js";
import { computeNightDrivingBlocks, computeLowFuelSegmentPath } from "./lib/tripMapSegments.js";
import { computeDayRoutePaths } from "./lib/itineraryMap.js";
import { consolidateAndCapAlerts } from "./lib/tripAlerts.js";
import { buildPlanSnapshot, isPlanOutOfDate } from "./lib/planSnapshot.js";
import { describePlanChanges, formatRegenerateDiffBlock } from "./lib/planSnapshotDiff.js";
import { formatGenerationHints } from "./lib/tripConstraintsSummary.js";
import { formatActionTipsBlock } from "./lib/tripTips.js";
import { formatCollaborationHints } from "./lib/collaborationHints.js";
import CollaborationPanel from "./components/CollaborationPanel.jsx";
import { fetchTruckRoute, shouldUseTruckRouting, truckRestrictionsToTips, weighStationsToRoadStops } from "./lib/truckRoutingApi.js";
import { deriveCitiesAlongRoute, parseCityStateFromFormattedAddress } from "./lib/routeCities.js";
import { createAnswerChangeTracker, recordAnswerChange, formatAnswerConfidenceNotes, buildQuestionLabelMap } from "./lib/answerIntent.js";
import {
  buildRecentTripsContext,
  resolveAnswersWithFallback,
  detectAnswerGaps,
  formatGracefulDegradationNotes,
  fetchUserTripPreferences,
  recordUserStopPreferences,
  buildFlowPrefillFromPreferences,
  mergeDisplayAnswers,
  stripUnconfirmedPrefillFromAnswers,
  stripAnswersForSonnet,
} from "./lib/generationContext.js";
import { formatCreditsDisplay } from "./lib/creditsDisplay.js";
import {
  buildUserPatternSummary,
  buildRecentTripsPreferencesRollup,
  buildTravelerDossier,
} from "./lib/tripHistoryAnalysis.js";
import {
  fetchIsoline,
  pointInPolygon,
  reverseGeocodeLatLng,
  resolveHeroOriginCoords,
} from "./lib/heroExplore.js";
import { roadStopKey, normalizeRoadStopEntry } from "./lib/roadStopKeys.js";
import { useLiveTripTips } from "./hooks/useLiveTripTips.js";
import { usePlanDraft, loadPlanDraft, clearPlanDraft } from "./hooks/usePlanDraft.js";
import { useAuth } from "./context/AuthContext.jsx";
import { deleteTrip, fetchTrips, migrateLocalTrips, saveTrip } from "./lib/tripsApi.js";
import { fetchTripCredits } from "./lib/tripCreditsApi.js";
import { TIERS, normalizeTier } from "./lib/tiers.js";
import { runAccountOnboarding } from "./lib/accountOnboardingApi.js";
import { captureReferralFromUrl, getStoredReferralCode, clearStoredReferralCode } from "./lib/referralCapture.js";
import { dismissTrialEndedPrompt } from "./lib/trialApi.js";
import { createPortalSession } from "./lib/stripeApi.js";
import { fetchPlanPreferencesFull } from "./lib/planPreferencesApi.js";
import {
  LazyEmailModal,
  LazyFounderWelcomeOverlay,
  LazyGenerationStreamOverlay,
  LazyHomeAddressModal,
  LazyOAuthComingSoonModal,
  LazyPhoneModal,
  LazyReportIssueModal,
  LazySignInModal,
  LazyUpgradeModal,
  LazyUserPreferencesPage,
} from "./components/LazyModals.jsx";
import { getDisplayName } from "./lib/avatarUtils.js";
import { useTheme } from "./context/ThemeContext.jsx";
import { fetchUserProfile, saveHomeAddress, saveDisplayName, saveNotificationPrefs, saveEmergencyContact, uploadAvatar, getGuestHomeAddress, setGuestHomeAddress } from "./lib/profileApi.js";

import PlanFlowHeaderBar from "./components/PlanFlowHeaderBar.jsx";
import PlanPanelHelpButton from "./components/PlanPanelHelpButton.jsx";
import HeroView from "./components/HeroView.jsx";
import AppNavBar from "./components/AppNavBar.jsx";
import AppMap from "./components/AppMap.jsx";
import PlanPanel from "./components/PlanPanel.jsx";
import PlanPanelDock from "./components/PlanPanelDock.jsx";
import TripsPanel from "./components/TripsPanel.jsx";
import { LazyTripResultsPanel, LazyLiveViewPage, LazyProfilePage, LazySharePanel } from "./components/LazyPanels.jsx";
import { parseLiveShareToken } from "./lib/liveShareApi.js";
import { resolveAppRoute } from "./lib/appRouter.js";
import { sendSmsOtp, verifySmsOtp } from "./lib/phoneAuthApi.js";
import Toast from "./components/Toast.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ConfigWarningBanner from "./components/ConfigWarningBanner.jsx";

export default function App() {
  const { user, session, signUp, signIn, signOut, resetPassword, signInWithOAuth, setSessionFromTokens, updateEmail, updatePassword, isConfigured: isAuthConfigured, loading: authLoading } = useAuth();
  const [view, setView] = useState("hero"); // "hero" | "app" | "profile"
  const [tab, setTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [heroOrigin, setHeroOrigin] = useState("");
  const [heroDest, setHeroDest] = useState("");
  const [heroOriginError, setHeroOriginError] = useState("");
  const [heroDestError, setHeroDestError] = useState("");
  const [heroLaunching, setHeroLaunching] = useState(false);
  const [heroExploreEnabled, setHeroExploreEnabled] = useState(false);
  const [heroExploreDriveSeconds, setHeroExploreDriveSeconds] = useState(7200);
  const [heroExplorePolygon, setHeroExplorePolygon] = useState([]);
  const [heroExploreLoading, setHeroExploreLoading] = useState(false);
  const [heroExploreError, setHeroExploreError] = useState(null);
  const [heroOriginCoords, setHeroOriginCoords] = useState(null);
  const heroExploreAbortRef = useRef(null);
  const [heroEmail, setHeroEmail] = useState("");
  const [authModal, setAuthModal] = useState(null); // signin | signup | phone | oauth-*
  const [authPhone, setAuthPhone] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [timingMode, setTimingMode] = useState("leave_now");
  const [arriveByDate, setArriveByDate] = useState("");
  const [prefDraft, setPrefDraft] = useState(null);
  const [mapStyle, setMapStyle] = useState("standard");
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [trafficAlert, setTrafficAlert] = useState(false);
  const [answers, setAnswers] = useState({});
  const [flowPrefill, setFlowPrefill] = useState({});
  const [continuousDriveConfirm, setContinuousDriveConfirm] = useState(null);
  const [qIndex, setQIndex] = useState(-1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [resultsView, setResultsView] = useState("planning"); // planning | itinerary | map
  const [stops, setStops] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [personalTouches, setPersonalTouches] = useState([]);
  const [changesMade, setChangesMade] = useState([]);
  const [enrichingTrip, setEnrichingTrip] = useState(false);
  const [enrichmentLimited, setEnrichmentLimited] = useState(false);
  const [enrichmentNoticeDismissed, setEnrichmentNoticeDismissed] = useState(false);
  const [planDraft, setPlanDraft] = useState(() => loadPlanDraft());
  const [roadStops, setRoadStops] = useState([]);
  const [tripFormat, setTripFormat] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedLodging, setSelectedLodging] = useState([]);
  const [tripAlerts, setTripAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [mapMarkers, setMapMarkers] = useState([]);
  const [customStops, setCustomStops] = useState([]);
  const [activitiesByCity, setActivitiesByCity] = useState({});
  const [restaurantsByCity, setRestaurantsByCity] = useState({});
  const [weatherByCity, setWeatherByCity] = useState({});
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [optionalStopCards, setOptionalStopCards] = useState([]);
  const [nightSegmentPaths, setNightSegmentPaths] = useState([]);
  const [lowFuelSegmentPaths, setLowFuelSegmentPaths] = useState([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [tripLegs, setTripLegs] = useState([]);
  const [savedTrips, setSavedTrips] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tripmappa-saved") || "[]"); } catch { return []; }
  });
  const savedTripsRef = useRef(savedTrips);
  const [planGenerationCount, setPlanGenerationCount] = useState(0);
  const [creditStatus, setCreditStatus] = useState(null);
  const creditStatusRef = useRef(null);
  const [creditsNeedRefresh, setCreditsNeedRefresh] = useState(0);
  const [generationStream, setGenerationStream] = useState(null);
  const foundingClaimAttemptedRef = useRef(false);
  const trialPromptShownRef = useRef(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState("trips");
  const [upgradeModalResetDate, setUpgradeModalResetDate] = useState(null);
  const [upgradeModalInitialPlan, setUpgradeModalInitialPlan] = useState(null);
  const [upgradeModalBillingInterval, setUpgradeModalBillingInterval] = useState("month");
  const [homeAddress, setHomeAddress] = useState("");
  const [showHomeAddressModal, setShowHomeAddressModal] = useState(false);
  const [navigateHomePending, setNavigateHomePending] = useState(false);
  const [returnedFromResults, setReturnedFromResults] = useState(false);
  const [highlightedStopId, setHighlightedStopId] = useState(null);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const [liveSharingActive, setLiveSharingActive] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [tripUsedFallback, setTripUsedFallback] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteTripId, setConfirmDeleteTripId] = useState(null);
  const [resultsBoundaryKey, setResultsBoundaryKey] = useState(0);
  const [planBoundaryKey, setPlanBoundaryKey] = useState(0);
  const [mapBoundaryKey, setMapBoundaryKey] = useState(0);
  const [savedPlanSnapshot, setSavedPlanSnapshot] = useState(null);
  const [showCollabPanel, setShowCollabPanel] = useState(false);
  const [activeCollaboration, setActiveCollaboration] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const collaborationHintsRef = useRef("");
  const actionTipHintsRef = useRef("");
  const [dismissedActionTipIds, setDismissedActionTipIds] = useState([]);
  const AppRoutePage = useMemo(() => resolveAppRoute(), []);
  const liveShareToken = useMemo(() => parseLiveShareToken(), []);
  const [profileScrollTo, setProfileScrollTo] = useState(null);
  const [founderWelcomeName, setFounderWelcomeName] = useState(null);
  const planPreferencesRef = useRef({});
  const highlightTimerRef = useRef(null);

  function applyCreditStatus(next) {
    creditStatusRef.current = next;
    setCreditStatus(next);
  }

  function applySavedTrips(next) {
    savedTripsRef.current = next;
    setSavedTrips(next);
  }

  function prependSavedTrip(saved) {
    if (saved?.id) setActiveTripId(saved.id);
    applySavedTrips([saved, ...savedTripsRef.current.filter(t => t.id !== saved.id)]);
  }

  function applyPlanPreferencesSaved(prefs, meta) {
    planPreferencesRef.current = prefs || {};
    if (meta?.generation_count != null) {
      setPlanGenerationCount(Number(meta.generation_count) || 0);
    }
  }

  function openAuthModal(mode) {
    setAuthError("");
    setAuthModal(mode);
  }

  async function handleOAuth(provider) {
    setAuthError("");
    if (!isAuthConfigured) {
      openAuthModal(`oauth-${provider}`);
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setAuthBusy(false);
      setAuthError(err.message || `${provider} sign in failed`);
      openAuthModal(`oauth-${provider}`);
    }
  }

  async function handleEmailSignUp({ email, password }) {
    if (!email?.trim()) {
      setAuthError("Enter your email");
      return;
    }
    if (!password || password.length < 8) {
      setAuthError("Password must be at least 8 characters");
      return;
    }
    if (!isAuthConfigured) {
      toast_("Auth is not configured — add Supabase env vars");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const { session } = await signUp(email, password);
      if (session) {
        toast_("Welcome to TripMappa!", true);
        setAuthModal(null);
        setGuestBannerDismissed(true);
        refreshCredits();
      } else {
        toast_("Check your email to confirm your account", true);
        setAuthModal(null);
      }
    } catch (err) {
      setAuthError(err.message || "Sign up failed");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignInSubmit({ email, password }) {
    if (!email?.trim() || !password) {
      setAuthError("Enter email and password");
      return;
    }
    if (!isAuthConfigured) {
      toast_("Auth is not configured — add Supabase env vars");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      await signIn(email, password);
      toast_("Signed in", true);
      setAuthModal(null);
      setGuestBannerDismissed(true);
      refreshCredits();
    } catch (err) {
      setAuthError(err.message || "Sign in failed");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(email) {
    if (!email?.trim()) {
      toast_("Enter your email first");
      return;
    }
    if (!isAuthConfigured) {
      toast_("Auth is not configured — add Supabase env vars");
      return;
    }
    try {
      await resetPassword(email);
      toast_("Password reset email sent — check your inbox", true);
    } catch (err) {
      toast_(err.message || "Could not send reset email");
    }
  }

  async function handlePhoneSendCode(phone) {
    setAuthBusy(true);
    setAuthError("");
    try {
      await sendSmsOtp(phone);
      setAuthPhone(phone);
      toast_("Verification code sent", true);
      return true;
    } catch (err) {
      setAuthError(err.message || "Could not send code");
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePhoneVerify(phone, code) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const session = await verifySmsOtp(phone, code);
      await setSessionFromTokens({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      toast_("Signed in", true);
      setAuthModal(null);
      setAuthPhone("");
    } catch (err) {
      setAuthError(err.message || "Could not verify code");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePhoneResend(phone) {
    return handlePhoneSendCode(phone);
  }

  function openLazyPhoneModal() {
    setAuthError("");
    setAuthPhone("");
    setAuthModal("phone");
  }

  async function handleSignOut() {
    intentionalSignOutRef.current = true;
    try {
      await signOut();
      setView("hero");
      setUserProfile(null);
      applyCreditStatus(getGuestCreditStatus());
      toast_("Signed out");
    } catch (err) {
      intentionalSignOutRef.current = false;
      toast_(err.message || "Could not sign out");
    }
  }

  function buildTripSavePayload() {
    return {
      origin,
      dest,
      date: new Date().toLocaleDateString(),
      stops,
      roadStops,
      tripTips,
      personalTouches,
      changesMade,
      answers: stripSessionOnlyAnswers(answers),
      routeInfo,
      selectedLodging,
    };
  }

  async function persistTripForUser(userId) {
    const tripPayload = buildTripSavePayload();
    const saved = await saveTrip(userId, tripPayload);
    prependSavedTrip(saved);
    const userAddedStops = (roadStops || []).filter(s => s.userAdded);
    if (userAddedStops.length && session?.access_token) {
      void recordUserStopPreferences(
        session.access_token,
        userAddedStops,
        userAddedStops.length,
        { incrementTrip: true },
      );
    }
    return saved;
  }

  async function deleteSavedTrip(id) {
    if (user) {
      try {
        await deleteTrip(user.id, id);
      } catch (err) {
        toast_(err.message || "Could not delete trip", { isError: true });
        return;
      }
    }
    const updated = savedTripsRef.current.filter(t => t.id !== id);
    applySavedTrips(updated);
    if (!user) {
      try { localStorage.setItem("tripmappa-saved", JSON.stringify(updated)); } catch { /* quota / private mode */ }
    }
    toast_("Trip removed");
  }

  function requestDeleteSavedTrip(id) {
    setConfirmDeleteTripId(id);
  }
  const [toast, setToast] = useState(null);
  const [toastIsGold, setToastIsGold] = useState(false);
  const [toastIsError, setToastIsError] = useState(false);
  const [toastAction, setToastAction] = useState(null);
  const toastTimerRef = useRef(null);
  const generateAbortRef = useRef(null);
  const generateTripInFlightRef = useRef(false);
  const enrichAbortRef = useRef(null);
  const hadUserRef = useRef(false);
  const intentionalSignOutRef = useRef(false);
  const sessionExpiredNotifiedRef = useRef(false);
  const [guestTripPendingSave, setGuestTripPendingSave] = useState(false);
  const panelDragStartY = useRef(null);
  const panelDragMoved = useRef(false);
  const [modal, setModal] = useState(null);
  const { theme } = useTheme();
  const [enterAnim, setEnterAnim] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const [stepAnim, setStepAnim] = useState(null); // { answer, phase: 'selected' | 'exit' }
  const stepAnimTimer = useRef(null);
  const helpWrapRef = useRef(null);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      try {
        applySavedTrips(JSON.parse(localStorage.getItem("tripmappa-saved") || "[]"));
      } catch {
        applySavedTrips([]);
      }
      return undefined;
    }

    setAuthModal(null);
    setAuthBusy(false);

    let cancelled = false;
    (async () => {
      try {
        await migrateLocalTrips(user.id);
        const trips = await fetchTrips(user.id);
        if (!cancelled) applySavedTrips(trips);
      } catch (err) {
        console.warn("Could not load saved trips:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      hadUserRef.current = true;
      sessionExpiredNotifiedRef.current = false;
      return;
    }
    if (hadUserRef.current && !intentionalSignOutRef.current && !sessionExpiredNotifiedRef.current) {
      sessionExpiredNotifiedRef.current = true;
      toast_("Your session expired — please sign in again", {
        actionLabel: "Sign In",
        onAction: () => openAuthModal("signin"),
        duration: 8000,
      });
    }
    intentionalSignOutRef.current = false;
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || !user?.id || !guestTripPendingSave) return undefined;
    if (!generated || !origin?.trim() || !dest?.trim()) {
      setGuestTripPendingSave(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        await persistTripForUser(user.id);
        const normalizedAnswers = normalizeTripAnswers(
          answers,
          buildQuestionContext(answers),
          { forGeneration: true },
        );
        if (session?.access_token) {
          void writeBackPlanPreferencesSilently(
            session.access_token,
            normalizedAnswers,
            applyPlanPreferencesSaved,
          );
        }
        if (!cancelled) {
          setGuestTripPendingSave(false);
          toast_("Your trip has been saved to your account.", true);
        }
      } catch (err) {
        console.warn("Auto-save guest trip failed:", err);
        if (!cancelled) setGuestTripPendingSave(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, guestTripPendingSave, authLoading, generated]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.id && session?.access_token) {
      fetchTripCredits(session.access_token)
        .then(applyCreditStatus)
        .catch(() => applyCreditStatus({ tier: "wanderer", unlimited: false, remaining: 3, limit: 3 }));
      fetchUserProfile(user.id)
        .then(profile => {
          if (profile?.home_address) setHomeAddress(profile.home_address);
          setUserProfile(profile);
        })
        .catch(() => {});
    } else {
      applyCreditStatus(getGuestCreditStatus());
      setUserProfile(null);
      const guestHome = getGuestHomeAddress();
      if (guestHome) setHomeAddress(guestHome);
    }
  }, [user?.id, session?.access_token, authLoading, creditsNeedRefresh]);

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    if (!user?.id || !session?.access_token) {
      planPreferencesRef.current = {};
      setPlanGenerationCount(0);
      return undefined;
    }
    let cancelled = false;
    fetchPlanPreferencesFull(session.access_token)
      .then(({ preferences, meta }) => {
        if (!cancelled) {
          applyPlanPreferencesSaved(preferences, meta);
          if (!convoComplete && !generated && questionHistory.length === 0) {
            buildFlowPrefillForUser().then(setFlowPrefill);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          planPreferencesRef.current = {};
          setPlanGenerationCount(0);
        }
      });
    return () => { cancelled = true; };
  }, [user?.id, session?.access_token]);

  async function buildFlowPrefillForUser() {
    let tripPrefs = null;
    if (user?.id && session?.access_token) {
      try {
        tripPrefs = await fetchUserTripPreferences(session.access_token);
      } catch {
        tripPrefs = null;
      }
    }
    return buildFlowPrefillFromPreferences(planPreferencesRef.current, tripPrefs);
  }

  useEffect(() => {
    foundingClaimAttemptedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !session?.access_token) return undefined;
    if (foundingClaimAttemptedRef.current) return undefined;
    foundingClaimAttemptedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const refCode = getStoredReferralCode();
        const result = await runAccountOnboarding(session.access_token, { refCode });
        if (cancelled) return;
        if (result.credits) applyCreditStatus(result.credits);
        const profile = await fetchUserProfile(user.id);
        if (!cancelled && profile) setUserProfile(profile);

        if (result.referral?.applied) {
          clearStoredReferralCode();
          toast_("Referral applied. You both received one free month of Voyager.", true);
        }
        if (
          result.credits?.tier === "trailblazer"
          && profile
          && !profile.founder_expires_at
          && !profile.trailblazer_trial_ends_at
          && !result.trialStarted
        ) {
          toast_("Admin access enabled. You have permanent Trailblazer.", true);
        } else if (result.founder?.claimed && !result.founder?.already) {
          const welcomeName = getDisplayName(user, profile).split(" ")[0] || "Explorer";
          setFounderWelcomeName(welcomeName);
        } else if (result.trialStarted) {
          toast_("Your 7-day Trailblazer trial has started.", true);
        }
      } catch {
        /* onboarding optional when DB or slots unavailable */
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, user?.id, session?.access_token]);

  useEffect(() => {
    trialPromptShownRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !session?.access_token) return undefined;
    if (!creditStatus?.showTrialEndedPrompt || trialPromptShownRef.current) return undefined;

    trialPromptShownRef.current = true;
    setUpgradeModalReason("trial-ended");
    setShowUpgradeModal(true);
    dismissTrialEndedPrompt(session.access_token)
      .then(() => setCreditsNeedRefresh(n => n + 1))
      .catch(() => {});

    return undefined;
  }, [authLoading, user?.id, session?.access_token, creditStatus?.showTrialEndedPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    if (success !== "1" && success !== "true") return undefined;

    params.delete("success");
    const remainder = params.toString();
    const cleanUrl = `${window.location.pathname}${remainder ? `?${remainder}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", cleanUrl);

    setCreditsNeedRefresh(n => n + 1);
    setShowUpgradeModal(false);

    if (authLoading) return undefined;

    if (user?.id && session?.access_token) {
      fetchTripCredits(session.access_token)
        .then(credits => {
          applyCreditStatus(credits);
          const paidTier = normalizeTier(credits?.storedTier ?? credits?.tier);
          if (paidTier === TIERS.VOYAGER) {
            toast_("Welcome to TripMappa Voyager.", true);
          } else if (paidTier === TIERS.TRAILBLAZER) {
            toast_("Welcome to TripMappa Trailblazer.", true);
          }
        })
        .catch(() => {});
      fetchUserProfile(user.id)
        .then(profile => {
          if (profile) setUserProfile(profile);
        })
        .catch(() => {});
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, session?.access_token]);

  useEffect(() => {
    if (view === "profile" && !authLoading && !user) {
      setView("app");
      openAuthModal("signin");
    }
  }, [view, user, authLoading]);

  // ── Google Maps ──
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [truckRoutePath, setTruckRoutePath] = useState(null);
  const [directionsResult, setDirectionsResult] = useState(null);
  const answerChangeCountsRef = useRef(createAnswerChangeTracker());
  const reAnswerFromEditRef = useRef(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const mapCenter = { lat: 37.0902, lng: -95.7129 };
  const originRef = useRef(null);
  const destRef = useRef(null);
  const heroOriginRef = useRef(null);
  const heroDestRef = useRef(null);
  const heroOriginAcRef = useRef(null);
  const heroDestAcRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const polylinesRef = useRef([]);
  const polylineAnimRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const directionsFetchRef = useRef(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const toastFnRef = useRef(null);

  const fetchDirections = useCallback((vehicleType) => {
    const originVal = originRef.current?.value?.trim() || origin?.trim();
    const destVal = destRef.current?.value?.trim() || dest?.trim();
    if (!originVal || !destVal) return Promise.resolve({ ok: false });

    const vehicle = vehicleType || answers.vehicle || "Car";

    if (shouldUseTruckRouting({ ...answers, vehicle })) {
      setRouteLoading(true);
      setTrafficAlert(false);
      const requestKey = `truck|${originVal}|${destVal}|${vehicle}|${answers.truck_height}|${answers.truck_weight}|${answers.truck_hazmat}`;
      if (directionsFetchRef.current?.key === requestKey) {
        return directionsFetchRef.current.promise;
      }

      const promise = fetchTruckRoute(originVal, destVal, { ...answers, vehicle })
        .then(async (data) => {
          setRouteLoading(false);
          setRouteError(null);
          const restrictions = data.restrictions || [];
          if (restrictions.some(r => r.severity === "warning" || r.severity === "critical")) {
            setTrafficAlert(true);
          }

          const routePoints = data.routePoints || [];
          const citiesAlongRoute = await deriveCitiesAlongRoute(routePoints, {
            origin: originVal,
            destination: destVal,
            distance: data.distance,
          });
          const nextRouteInfo = {
            distance: data.distance,
            duration: data.duration,
            start: originVal.split(",")[0],
            end: destVal.split(",")[0],
            origin: originVal,
            destination: destVal,
            originLat: routePoints[0]?.lat,
            originLng: routePoints[0]?.lng,
            destLat: routePoints[routePoints.length - 1]?.lat,
            destLng: routePoints[routePoints.length - 1]?.lng,
            citiesAlongRoute,
            routePoints,
            vehicleType: vehicle,
            timingMode,
            arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
            scenic: isScenicRoute(answers),
            truckSafe: true,
            rvSafe: false,
            routeProvider: "here",
            truckHeight: answers.truck_height,
            truckWeight: answers.truck_weight,
            truckHazmat: answers.truck_hazmat,
            restrictions,
            weighStations: data.weighStations || [],
            herePolyline: data.polyline,
          };

          setRouteInfo(nextRouteInfo);
          setOrigin(originVal);
          setDest(destVal);
          setTruckRoutePath(routePoints);
          setRoutePath(routePoints);
          setDirectionsResult(null);

          if (mapRef.current && routePoints.length > 1) {
            const bounds = new window.google.maps.LatLngBounds();
            routePoints.forEach(p => bounds.extend(p));
            mapRef.current.fitBounds(bounds, { padding: 60 });
          }

          return { ok: true, routeInfo: nextRouteInfo };
        })
        .catch((err) => {
          setRouteLoading(false);
          const msg = err.message || "Could not calculate truck route. Check addresses and try again.";
          setRouteError(msg);
          setRouteInfo(null);
          setRoutePath(null);
          setTruckRoutePath(null);
          setDirectionsResult(null);
          toast_(msg, { duration: 7000 });
          return { ok: false };
        });

      directionsFetchRef.current = { key: requestKey, promise };
      promise.finally(() => {
        if (directionsFetchRef.current?.key === requestKey) {
          directionsFetchRef.current = null;
        }
      });
      return promise;
    }

    if (!window.google) return Promise.resolve({ ok: false });
    setRouteLoading(true);
    setTrafficAlert(false);

    const scenic = isScenicRoute(answers);
    const routeRequest = {
      origin: originVal,
      destination: destVal,
      travelMode: window.google.maps.TravelMode.DRIVING,
    };

    if (timingMode === "leave_now") {
      routeRequest.drivingOptions = {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    } else if (timingMode === "arrive_by" && arriveByDate) {
      routeRequest.drivingOptions = {
        arrivalTime: new Date(arriveByDate),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    }

    if (isTruckVehicle(vehicle)) {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    } else if (isRvVehicle(vehicle)) {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    }

    if (scenic || hasPref(answers, "Avoid highways")) routeRequest.avoidHighways = true;
    if (hasPref(answers, "Avoid tolls")) routeRequest.avoidTolls = true;
    if (isTowingSelected(answers)) {
      routeRequest.avoidHighways = true;
      routeRequest.provideRouteAlternatives = true;
      routeRequest.avoidFerries = true;
    }

    const service = new window.google.maps.DirectionsService();
    const requestKey = `${originVal}|${destVal}|${vehicle}|${timingMode}|${arriveByDate || ""}|${scenic}`;
    if (directionsFetchRef.current?.key === requestKey) {
      return directionsFetchRef.current.promise;
    }

    const promise = new Promise((resolve) => {
      service.route(routeRequest, (result, status) => {
        setRouteLoading(false);
        if (status === "OK") {
          setRouteError(null);
          const route = result.routes[0];
          const leg = route.legs[0];
          const warnings = route.warnings || [];
          const hasTrafficDelay = warnings.some(w => /traffic|delay|congestion|slow/i.test(w))
            || route.legs.some(l => l.duration_in_traffic && l.duration_in_traffic.value > l.duration.value * 1.08);
          if (warnings.length > 0 || hasTrafficDelay) setTrafficAlert(true);

          const citiesAlongRoute = [];
          route.legs[0].steps.forEach(step => {
            if (!step.end_address) return;
            const cityState = parseCityStateFromFormattedAddress(step.end_address);
            if (cityState && !citiesAlongRoute.includes(cityState)) citiesAlongRoute.push(cityState);
          });

          const nextRouteInfo = {
            distance: leg.distance.text,
            duration: leg.duration.text,
            start: leg.start_address.split(",")[0],
            end: leg.end_address.split(",")[0],
            origin: originVal,
            destination: destVal,
            originLat: typeof leg.start_location.lat === "function" ? leg.start_location.lat() : leg.start_location.lat,
            originLng: typeof leg.start_location.lng === "function" ? leg.start_location.lng() : leg.start_location.lng,
            destLat: typeof leg.end_location.lat === "function" ? leg.end_location.lat() : leg.end_location.lat,
            destLng: typeof leg.end_location.lng === "function" ? leg.end_location.lng() : leg.end_location.lng,
            citiesAlongRoute: citiesAlongRoute.slice(0, 15),
            routePoints: route.overview_path.map(p => ({
              lat: typeof p.lat === "function" ? p.lat() : p.lat,
              lng: typeof p.lng === "function" ? p.lng() : p.lng,
            })),
            vehicleType: vehicle,
            timingMode,
            arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
            scenic,
            truckSafe: isTruckVehicle(vehicle),
            rvSafe: isRvVehicle(vehicle),
            truckHeight: answers.truck_height,
            truckWeight: answers.truck_weight,
            truckHazmat: answers.truck_hazmat,
            rvHeight: answers.rv_height,
            rvWeight: answers.rv_weight,
            rvTowing: answers.rv_towing,
          };
          setRouteInfo(nextRouteInfo);
          setOrigin(originVal);
          setDest(destVal);
          setRoutePath(route.overview_path);
          setTruckRoutePath(null);
          setDirectionsResult(result);

          if (mapRef.current) {
            const bounds = new window.google.maps.LatLngBounds();
            route.legs[0].steps.forEach(step => {
              bounds.extend(step.start_location);
              bounds.extend(step.end_location);
            });
            mapRef.current.fitBounds(bounds, { padding: 60 });
          }
          resolve({ ok: true, routeInfo: nextRouteInfo });
        } else {
          const msg = status === "ZERO_RESULTS"
            ? "No driving route found between these places."
            : status === "NOT_FOUND"
              ? "Could not find one or both addresses."
              : "Could not calculate route. Check addresses and try again.";
          setRouteError(msg);
          setRouteInfo(null);
          setRoutePath(null);
          setTruckRoutePath(null);
          setDirectionsResult(null);
          toast_(msg, { duration: 7000 });
          resolve({ ok: false });
        }
      });
    });
    directionsFetchRef.current = { key: requestKey, promise };
    promise.finally(() => {
      if (directionsFetchRef.current?.key === requestKey) {
        directionsFetchRef.current = null;
      }
    });
    return promise;
  }, [timingMode, arriveByDate, answers, origin, dest]);

  const fetchRouteBetween = useCallback((originVal, destVal) => {
    if (!originVal || !destVal || !window.google) return Promise.resolve(false);
    setRouteLoading(true);
    setTrafficAlert(false);

    const routeRequest = {
      origin: originVal,
      destination: destVal,
      travelMode: window.google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      },
    };

    const service = new window.google.maps.DirectionsService();
    return new Promise((resolve) => {
      service.route(routeRequest, (result, status) => {
        setRouteLoading(false);
        if (status === "OK") {
          const route = result.routes[0];
          const leg = route.legs[0];
          setRouteInfo({
            distance: leg.distance.text,
            duration: leg.duration.text,
            start: leg.start_address.split(",")[0],
            end: leg.end_address.split(",")[0],
            origin: originVal,
            destination: destVal,
            originLat: typeof leg.start_location.lat === "function" ? leg.start_location.lat() : leg.start_location.lat,
            originLng: typeof leg.start_location.lng === "function" ? leg.start_location.lng() : leg.start_location.lng,
            destLat: typeof leg.end_location.lat === "function" ? leg.end_location.lat() : leg.end_location.lat,
            destLng: typeof leg.end_location.lng === "function" ? leg.end_location.lng() : leg.end_location.lng,
            routePoints: route.overview_path.map(p => ({
              lat: typeof p.lat === "function" ? p.lat() : p.lat,
              lng: typeof p.lng === "function" ? p.lng() : p.lng,
            })),
            vehicleType: "Car",
            timingMode: "leave_now",
          });
          setRoutePath(route.overview_path);
          setDirectionsResult(result);
          if (mapRef.current) {
            const bounds = new window.google.maps.LatLngBounds();
            route.legs[0].steps.forEach(step => {
              bounds.extend(step.start_location);
              bounds.extend(step.end_location);
            });
            mapRef.current.fitBounds(bounds, { padding: 60 });
          }
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }, []);

  function formatCreditsLabel(status) {
    return formatCreditsDisplay(status).label;
  }

  const creditsNudge = useMemo(
    () => formatCreditsDisplay(creditStatus).nudge,
    [creditStatus],
  );

  const flowProgress = useMemo(() => getFlowProgress(answers, buildQuestionContext(answers), {
    convoComplete,
    currentQuestionId: convoComplete ? "done" : (currentQuestion?.id || "vehicle"),
  }), [answers, convoComplete, currentQuestion?.id, origin, dest, routeInfo]);

  const displayAnswers = useMemo(
    () => mergeDisplayAnswers(answers, flowPrefill, questionHistory),
    [answers, flowPrefill, questionHistory],
  );

  useEffect(() => {
    if (convoComplete || generated) return;
    const sanitized = stripUnconfirmedPrefillFromAnswers(answers, flowPrefill, questionHistory);
    if (sanitized !== answers) setAnswers(sanitized);
  }, [answers, flowPrefill, questionHistory, convoComplete, generated]);

  const currentPlanSnapshot = useMemo(() => buildPlanSnapshot({
    origin: originRef.current?.value?.trim() || origin,
    dest: destRef.current?.value?.trim() || dest,
    answers,
    routeInfo,
  }), [origin, dest, answers, routeInfo]);

  const planOutOfDate = useMemo(
    () => generated && isPlanOutOfDate(savedPlanSnapshot, currentPlanSnapshot),
    [generated, savedPlanSnapshot, currentPlanSnapshot],
  );

  const planChanges = useMemo(
    () => describePlanChanges(savedPlanSnapshot, currentPlanSnapshot),
    [savedPlanSnapshot, currentPlanSnapshot],
  );

  const configMissing = useMemo(() => {
    const missing = [];
    if (!import.meta.env.VITE_GOOGLE_MAPS_KEY) missing.push("maps");
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) missing.push("auth");
    return missing;
  }, []);

  const inQuestionFlow = !generated && (
    qIndex >= 0 ||
    Boolean(currentQuestion) ||
    (convoComplete && !returnedFromResults)
  );
  const showGuestSignInGate = !user && inQuestionFlow;
  const showPlanPanelDock = tab === "plan" && !cardCollapsed && !inQuestionFlow;

  const creditsExhausted = useMemo(() => {
    const status = creditStatus || (!user ? getGuestCreditStatus() : null);
    if (!status) return false;
    return !status.unlimited && (status.remaining ?? 0) <= 0;
  }, [creditStatus, user]);

  usePlanDraft({
    active: view === "app" && !generated,
    origin,
    dest,
    answers,
    questionHistory,
    convoComplete,
    qIndex,
    currentQuestion,
  });

  const {
    tips: displayLiveTips,
    updatedAt: liveTipsUpdatedAt,
    refreshing: liveTipsRefreshing,
  } = useLiveTripTips({
    generated,
    origin,
    dest,
    routePoints: routeInfo?.routePoints || [],
    stops,
    liveSharingActive,
    fallbackTips: tripTips,
  });

  function refreshCredits() {
    if (user && session?.access_token) {
      fetchTripCredits(session.access_token).then(applyCreditStatus).catch(() => {});
    } else {
      applyCreditStatus(getGuestCreditStatus());
    }
  }

  function openPlanPanel() {
    setView("app");
    setTab("plan");
    setCardCollapsed(false);
    window.scrollTo(0, 0);
  }

  function openProfile() {
    setProfileScrollTo(null);
    setView("profile");
    window.scrollTo(0, 0);
  }

  function openMyTrips() {
    setView("app");
    setTab("trips");
    setCardCollapsed(false);
    window.scrollTo(0, 0);
  }

  function openSharePanel() {
    setView("app");
    setTab("share");
    setCardCollapsed(false);
    window.scrollTo(0, 0);
  }

  function openProfileSettings() {
    setProfileScrollTo("settings");
    setView("profile");
    window.scrollTo(0, 0);
  }

  function openProfilePreferences() {
    setView("preferences");
    window.scrollTo(0, 0);
  }

  function handleNavOpenPlan() {
    openPlanPanel();
  }

  function handleNavOpenTrips() {
    openMyTrips();
  }

  function handleNavOpenShare() {
    openSharePanel();
  }

  const navActiveTab = useMemo(() => {
    if (view !== "app") return null;
    if (tab === "plan") return "plan";
    if (tab === "trips") return "trips";
    if (tab === "share") return "share";
    return null;
  }, [view, tab]);

  function renderAppNavBar(variant = "app") {
    return (
      <AppNavBar
        variant={variant}
        theme={theme}
        onGoHome={goHome}
        user={user}
        userProfile={userProfile}
        creditStatus={creditStatus}
        activeNav={navActiveTab}
        onOpenPlan={handleNavOpenPlan}
        onOpenTrips={handleNavOpenTrips}
        onOpenShare={handleNavOpenShare}
        onOpenProfile={openProfile}
        onRefreshCredits={refreshCredits}
        onUploadAvatar={handleProfileUploadAvatar}
        onGetStarted={() => openAuthModal("signup")}
        onSignIn={() => openAuthModal("signin")}
        onSignOut={handleSignOut}
        liveSharingActive={liveSharingActive}
      />
    );
  }

  async function handleProfileUploadAvatar(file) {
    const profile = await uploadAvatar(user.id, file);
    setUserProfile(profile);
  }

  async function handleProfileSaveDisplayName(name) {
    const profile = await saveDisplayName(user.id, name);
    setUserProfile(profile);
  }

  async function handleProfileSaveNotifications(prefs) {
    const profile = await saveNotificationPrefs(user.id, prefs);
    setUserProfile(profile);
  }

  async function handleManageSubscription() {
    if (!session?.access_token) {
      toast_("Sign in to manage your subscription", { isError: true });
      return;
    }
    try {
      const { url } = await createPortalSession(session.access_token);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast_(err.message || "Could not open billing portal", { isError: true });
    }
  }

  function openPricingPage() {
    setShowUpgradeModal(false);
    window.location.assign("/pricing");
  }

  function openTripsUpgrade(options = {}) {
    setUpgradeModalResetDate(options.resetDate ?? null);
    setUpgradeModalReason(options.limitReached ? "monthly-limit" : "trips");
    setUpgradeModalInitialPlan(options.plan ?? TIERS.TRAILBLAZER);
    setUpgradeModalBillingInterval(options.billingPeriod === "year" ? "year" : "month");
    setShowUpgradeModal(true);
  }

  function openVoyagerUpgrade(options = {}) {
    setUpgradeModalResetDate(null);
    setUpgradeModalReason("trips");
    setUpgradeModalInitialPlan(TIERS.VOYAGER);
    setUpgradeModalBillingInterval(options.billingPeriod === "year" ? "year" : "month");
    setShowUpgradeModal(true);
  }

  function openGroceryUpgrade() {
    setUpgradeModalReason("grocery");
    setShowUpgradeModal(true);
  }

  function goHome() {
    setAuthModal(null);
    setShowUpgradeModal(false);
    setShowHomeAddressModal(false);
    setModal(null);
    setHelpMenuOpen(false);
    setReturnedFromResults(false);
    setGuestBannerDismissed(false);
    setHighlightedStopId(null);
    setLoading(false);
    setGuestTripPendingSave(false);
    setView("hero");
    setTab("plan");
    setOrigin("");
    setDest("");
    setHeroOrigin("");
    setHeroDest("");
    setHeroOriginError("");
    setHeroDestError("");
    setAnswers({});
    setFlowPrefill({});
    setQIndex(-1);
    setCurrentQuestion(null);
    setQuestionHistory([]);
    setConvoComplete(false);
    setGenerated(false);
    setResultsView("planning");
    setStops([]);
    setTripTips([]);
    setPersonalTouches([]);
    setChangesMade([]);
    setRoadStops([]);
    setTripFormat(null);
    setRecommendations([]);
    setSelectedLodging([]);
    setTripLegs([]);
    setPrefDraft(null);
    setTripAlerts([]);
    setDismissedAlerts([]);
    setMapMarkers([]);
    setCustomStops([]);
    setActivitiesByCity({});
    setRestaurantsByCity({});
    setWeatherByCity({});
    setRouteOptimized(false);
    setOptionalStopCards([]);
    setNightSegmentPaths([]);
    setLowFuelSegmentPaths([]);
    setActiveDayIndex(0);
    setMapFocusTarget(null);
    setRouteInfo(null);
    setRoutePath(null);
    setTruckRoutePath(null);
    setDirectionsResult(null);
    setCardCollapsed(false);
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    if (originRef.current) originRef.current.value = "";
    if (destRef.current) destRef.current.value = "";
    if (heroOriginRef.current) heroOriginRef.current.value = "";
    if (heroDestRef.current) heroDestRef.current.value = "";
    setPlanDraft(loadPlanDraft());
    window.scrollTo(0, 0);
  }

  function handleEditTrip() {
    itinerarySync.resetItinerary();
    setResultsView("planning");
    setGenerated(false);
    setTab("plan");
    setCardCollapsed(false);
    setReturnedFromResults(true);
    setConvoComplete(true);
    setQIndex(-2);
    setCurrentQuestion(null);
    scrollPlanToTop();
  }

  function highlightStop(stopId) {
    if (!stopId) return;
    setHighlightedStopId(stopId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedStopId(null), 2000);
  }

  function handleMapMarkerSelect(marker) {
    if (!marker?.id) return;
    const stopId = marker.waypointId || marker.id;
    if (generated && itinerarySync.itineraryWaypoints.length) {
      itinerarySync.handleMarkerSelect(marker);
      highlightStop(stopId);
      return;
    }
    let legacyId = stopId;
    if (legacyId.startsWith("stop-")) {
      legacyId = `overnight-${legacyId.replace("stop-", "")}`;
    }
    highlightStop(legacyId);
    if (resultsView === "map" && generated) {
      setResultsView("itinerary");
    }
  }

  const recenterMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;

    if (directionsResult?.routes?.[0]?.legs) {
      directionsResult.routes[0].legs.forEach(leg => {
        leg.steps.forEach(step => {
          bounds.extend(step.start_location);
          bounds.extend(step.end_location);
          hasBounds = true;
        });
      });
    } else if (truckRoutePath?.length) {
      truckRoutePath.forEach(p => { bounds.extend(p); hasBounds = true; });
    } else if (routePath?.length) {
      routePath.forEach(p => {
        bounds.extend(typeof p.lat === "function" ? { lat: p.lat(), lng: p.lng() } : p);
        hasBounds = true;
      });
    } else if (routeInfo?.routePoints?.length) {
      routeInfo.routePoints.forEach(p => { bounds.extend(p); hasBounds = true; });
    }

    mapMarkers.forEach(m => {
      if (m?.lat != null && m?.lng != null) {
        bounds.extend({ lat: m.lat, lng: m.lng });
        hasBounds = true;
      }
    });

    if (hasBounds) mapRef.current.fitBounds(bounds, { padding: 60 });
  }, [directionsResult, routePath, truckRoutePath, routeInfo, mapMarkers]);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  async function runNavigateHome(home) {
    if (!home?.trim()) {
      setShowHomeAddressModal(true);
      return;
    }
    if (!isLoaded || !window.google) {
      toast_("Map is still loading — try again in a moment");
      return;
    }
    setNavigateHomePending(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const originStr = `${pos.coords.latitude},${pos.coords.longitude}`;
        const ok = await fetchRouteBetween(originStr, home.trim());
        setNavigateHomePending(false);
        if (ok) toast_("Route home ready", true);
        else toast_("Could not calculate route home");
      },
      () => {
        setNavigateHomePending(false);
        toast_("Enable location access to navigate home");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  function handleNavigateHome() {
    const home = homeAddress || getGuestHomeAddress();
    if (!home) {
      setNavigateHomePending(true);
      setShowHomeAddressModal(true);
      return;
    }
    runNavigateHome(home);
  }

  async function handleSaveHomeAddress(address) {
    const trimmed = address.trim();
    if (!trimmed) return;
    setHomeAddress(trimmed);
    setGuestHomeAddress(trimmed);
    setShowHomeAddressModal(false);
    if (user?.id) {
      try {
        await saveHomeAddress(user.id, trimmed);
      } catch (err) {
        console.warn("Could not save home address:", err);
      }
    }
    if (navigateHomePending) {
      setNavigateHomePending(false);
      runNavigateHome(trimmed);
    } else {
      toast_("Home address saved", true);
    }
  }

  useEffect(() => {
    if (view !== "app" || !isLoaded || !mapReady || !window.google) return;
    const o = origin?.trim();
    const d = dest?.trim();
    if (!o || !d) return;
    if (routeInfo?.origin === o && routeInfo?.destination === d && routePath) return;
    fetchDirections();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, isLoaded, mapReady, origin, dest, routeInfo?.origin, routeInfo?.destination, routePath]);

  useEffect(() => {
    if (view === "hero") setMapReady(false);
  }, [view]);

  const convoEndRef = useRef(null);
  const convoScrollRef = useRef(null);
  const floatCardScrollRef = useRef(null);

  const scrollPlanToTop = useCallback(() => {
    window.scrollTo(0, 0);
    convoScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    floatCardScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (view !== "app") return;
    scrollPlanToTop();
  }, [view, qIndex, currentQuestion?.id, scrollPlanToTop]);

  useEffect(() => {
    if (currentQuestion && !stepAnim) {
      setEnterAnim(true);
      const t = setTimeout(() => setEnterAnim(false), 320);
      return () => clearTimeout(t);
    }
  }, [currentQuestion?.id, stepAnim]);

  useEffect(() => {
    if (!currentQuestion?.id && !convoComplete) return;
    requestAnimationFrame(() => {
      convoEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [currentQuestion?.id, questionHistory.length, convoComplete]);

  useEffect(() => {
    if (!shouldPreloadGenerationLoader({
      convoComplete,
      currentQuestionId: currentQuestion?.id,
    })) return;
    preloadGenerationStreamOverlay().catch(() => undefined);
  }, [convoComplete, currentQuestion?.id]);

  useEffect(() => {
    if (!trafficAlert) return;
    const t = setTimeout(() => setTrafficAlert(false), 5000);
    return () => clearTimeout(t);
  }, [trafficAlert]);

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    if (!originRef.current?.value || !destRef.current?.value) return;
    if (answers.vehicle) fetchDirections(answers.vehicle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.preferences, answers.truck_height, answers.truck_weight, answers.rv_height, answers.rv_weight, answers.rv_towing]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const typeId = mapStyle === "satellite"
      ? window.google.maps.MapTypeId.SATELLITE
      : window.google.maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(typeId);
    applyMapThemeStyles(mapRef.current, mapStyle, theme);
  }, [mapStyle, theme, isLoaded, mapReady]);

  useEffect(() => {
    if (!mapRef.current || !window.google || !isLoaded || !mapReady) return;
    if (polylineAnimRef.current) {
      clearInterval(polylineAnimRef.current);
      polylineAnimRef.current = null;
    }
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;
    const ROUTE_GOLD = TRIP_ROUTE_GOLD;

    const drawLine = (path, style) => {
      if (!path?.length) return;
      const color = style.dashed ? (style.color || TRIP_ROUTE_GOLD) : TRIP_ROUTE_GOLD;
      const opts = {
        path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: style.dashed ? 0 : 0.9,
        strokeWeight: 5,
        map: mapRef.current,
      };
      if (style.dashed) {
        opts.strokeOpacity = 0;
        opts.icons = [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 3 },
          offset: "0",
          repeat: "16px",
        }];
      } else if (style.animate !== false) {
        opts.strokeOpacity = 0;
        opts.icons = [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 4 },
          offset: "0",
          repeat: "24px",
        }];
      }
      const pl = new window.google.maps.Polyline(opts);
      polylinesRef.current.push(pl);
      path.forEach(pt => { bounds.extend(pt); hasBounds = true; });
    };

    if (tripLegs.length > 0) {
      tripLegs.forEach(leg => {
        if (!leg.path) return;
        drawLine(leg.path, LEG_MAP_STYLES[leg.type] || LEG_MAP_STYLES.drive);
      });
    } else if (truckRoutePath?.length) {
      drawLine(truckRoutePath, { color: ROUTE_GOLD, dashed: false, animate: true });
    } else if (routePath && !directionsResult) {
      drawLine(routePath, { color: ROUTE_GOLD, dashed: false, animate: true });
    }

    if (hasBounds) mapRef.current.fitBounds(bounds, { padding: 60 });

    let dashOffset = 0;
    polylineAnimRef.current = setInterval(() => {
      dashOffset = (dashOffset + 2) % 48;
      polylinesRef.current.forEach(pl => {
        const icons = pl.get("icons");
        if (!icons?.length) return;
        pl.set("icons", icons.map((ic, i) => (i === 0 ? { ...ic, offset: `${dashOffset}px` } : ic)));
      });
    }, 50);

    return () => {
      if (polylineAnimRef.current) {
        clearInterval(polylineAnimRef.current);
        polylineAnimRef.current = null;
      }
    };
  }, [tripLegs, routePath, truckRoutePath, directionsResult, isLoaded, mapReady, theme, routeInfo?.scenic]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function toast_(msg, options = false) {
    const opts = typeof options === "boolean" ? { isGold: options } : options;
    const { isGold = false, isError = false, actionLabel, onAction, duration = isError ? 8000 : 2400 } = opts;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastIsGold(isGold);
    setToastIsError(isError);
    setToast(msg);
    if (actionLabel && onAction) {
      setToastAction({ label: actionLabel, onClick: onAction });
    } else {
      setToastAction(null);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      setToastAction(null);
      setToastIsError(false);
    }, actionLabel ? Math.max(duration, 8000) : duration);
  }
  toastFnRef.current = toast_;

  const itinerarySync = useItinerarySync({
    origin,
    dest,
    routeInfo,
    answers,
    timingMode,
    arriveByDate,
    optionalStopCards,
    activitiesByCity,
    restaurantsByCity,
    recommendations,
    mapRef,
    setRouteInfo,
    setDirectionsResult,
    setRoutePath,
    setTruckRoutePath,
    setStops,
    setRoadStops,
    setMapMarkers,
    toast_: (msg, opts) => toastFnRef.current?.(msg, opts),
  });

  function cancelGenerateTrip() {
    generateAbortRef.current?.abort();
    enrichAbortRef.current?.abort();
  }

  function ensurePayoffScreen() {
    setConvoComplete(true);
    setQIndex(-2);
    setCurrentQuestion(null);
  }

  function handlePanelTouchStart(e) {
    if (window.innerWidth > 767) return;
    panelDragStartY.current = e.touches[0].clientY;
    panelDragMoved.current = false;
  }

  function handlePanelTouchMove(e) {
    if (panelDragStartY.current == null) return;
    const dy = e.touches[0].clientY - panelDragStartY.current;
    if (Math.abs(dy) > 8) panelDragMoved.current = true;
  }

  function handlePanelTouchEnd(e) {
    if (panelDragStartY.current == null) return;
    const dy = e.changedTouches[0].clientY - panelDragStartY.current;
    if (dy > 48) setCardCollapsed(true);
    else if (dy < -48) setCardCollapsed(false);
    panelDragStartY.current = null;
  }

  function handlePanelHeaderClick() {
    if (panelDragMoved.current) {
      panelDragMoved.current = false;
      return;
    }
    setCardCollapsed(c => !c);
  }

  function handlePanelHeaderKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePanelHeaderClick();
    }
  }

  const handleMapBackgroundClick = useCallback(() => {
    /* Panel collapse is intentional-only via header chevron — never on map tap */
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (confirmResetOpen) { setConfirmResetOpen(false); e.preventDefault(); return; }
      if (confirmDeleteTripId) { setConfirmDeleteTripId(null); e.preventDefault(); return; }
      if (showHomeAddressModal) { setShowHomeAddressModal(false); setNavigateHomePending(false); e.preventDefault(); return; }
      if (showUpgradeModal) { setShowUpgradeModal(false); e.preventDefault(); return; }
      if (authModal) { setAuthModal(null); e.preventDefault(); return; }
      if (modal) { setModal(null); e.preventDefault(); return; }
      if (helpMenuOpen) { setHelpMenuOpen(false); e.preventDefault(); return; }
      if (mapStyleOpen) { setMapStyleOpen(false); e.preventDefault(); return; }
      if (view === "app" && generated && resultsView === "itinerary") {
        handleEditTrip();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, generated, resultsView, showHomeAddressModal, showUpgradeModal, authModal, modal, helpMenuOpen, mapStyleOpen, confirmResetOpen, confirmDeleteTripId]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function swapHeroCities() {
    const fromVal = heroOriginRef.current?.value ?? heroOrigin;
    const toVal = heroDestRef.current?.value ?? heroDest;
    if (heroOriginRef.current) heroOriginRef.current.value = toVal;
    if (heroDestRef.current) heroDestRef.current.value = fromVal;
    setHeroOrigin(toVal);
    setHeroDest(fromVal);
    setHeroOriginError("");
    setHeroDestError("");
  }

  function clearHeroExploreRange() {
    heroExploreAbortRef.current?.abort();
    heroExploreAbortRef.current = null;
    setHeroExplorePolygon([]);
    setHeroExploreLoading(false);
    setHeroExploreError(null);
  }

  const loadHeroExploreIsoline = useCallback(async (coords, driveSeconds) => {
    if (!coords?.lat || !coords?.lng || !driveSeconds) return;
    heroExploreAbortRef.current?.abort();
    const controller = new AbortController();
    heroExploreAbortRef.current = controller;
    setHeroExploreLoading(true);
    setHeroExploreError(null);
    try {
      const data = await fetchIsoline(coords.lat, coords.lng, driveSeconds, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const polygon = data.polygon || [];
      setHeroExplorePolygon(polygon);
      setHeroOriginCoords({ lat: coords.lat, lng: coords.lng });
      if (polygon.length < 3) {
        setHeroExploreError("Could not draw a range for this origin — try another city.");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setHeroExplorePolygon([]);
      setHeroExploreError(err.message || "Could not load explore range");
    } finally {
      if (heroExploreAbortRef.current === controller) {
        setHeroExploreLoading(false);
        heroExploreAbortRef.current = null;
      }
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!heroExploreEnabled) {
      clearHeroExploreRange();
      return undefined;
    }
    if (!isLoaded || !window.google) return undefined;

    let cancelled = false;
    (async () => {
      const text = heroOriginRef.current?.value?.trim() || heroOrigin.trim();
      const coords = heroOriginCoords
        || await resolveHeroOriginCoords(text, heroOriginAcRef.current);
      if (cancelled) return;
      if (!coords) {
        setHeroExplorePolygon([]);
        setHeroExploreError("Enter a valid origin to explore your range");
        setHeroExploreLoading(false);
        return;
      }
      setHeroOriginCoords({ lat: coords.lat, lng: coords.lng });
      await loadHeroExploreIsoline(coords, heroExploreDriveSeconds);
    })();

    return () => { cancelled = true; };
  }, [heroExploreEnabled, heroExploreDriveSeconds, heroOrigin, isLoaded, loadHeroExploreIsoline]);

  async function handleHeroExploreToggle(enabled) {
    setHeroExploreEnabled(enabled);
    if (!enabled) clearHeroExploreRange();
  }

  function handleHeroExploreDriveTimeChange(seconds) {
    setHeroExploreDriveSeconds(seconds);
  }

  async function applyHeroExploreDestination(label) {
    const value = label?.trim();
    if (!value) return;
    setHeroDest(value);
    if (heroDestRef.current) heroDestRef.current.value = value;
    setHeroDestError("");
    setHeroExploreEnabled(false);
    clearHeroExploreRange();
  }

  async function handleHeroExploreMapClick({ lat, lng }) {
    if (!heroExplorePolygon.length || !pointInPolygon(lat, lng, heroExplorePolygon)) return;
    const address = await reverseGeocodeLatLng(lat, lng);
    await applyHeroExploreDestination(address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  }

  async function handleHeroExplorePlaceSelect(place) {
    if (!place) return;
    const label = place.address ? `${place.name}, ${place.address}` : place.name;
    await applyHeroExploreDestination(label);
  }

  function captureHeroOriginCoordsFromAutocomplete() {
    const selected = heroOriginAcRef.current?.getPlace?.();
    if (!selected?.geometry?.location) return;
    setHeroOriginCoords({
      lat: selected.geometry.location.lat(),
      lng: selected.geometry.location.lng(),
    });
  }

  function swapRouteCities() {
    const fromVal = originRef.current?.value ?? origin;
    const toVal = destRef.current?.value ?? dest;
    if (originRef.current) originRef.current.value = toVal;
    if (destRef.current) destRef.current.value = fromVal;
    setOrigin(toVal);
    setDest(fromVal);
    setRouteError(null);
    setAnswers(prev => pruneRouteDependentAnswers(prev, buildQuestionContext(prev)));
    if (isLoaded && window.google && toVal && fromVal && answers.vehicle) fetchDirections(answers.vehicle);
  }

  async function launchFromHero() {
    if (!isLoaded || !window.google) {
      toast_("Map is still loading — try again in a moment");
      return;
    }

    const from = heroOriginRef.current?.value?.trim() || heroOrigin.trim();
    const to = heroDestRef.current?.value?.trim() || heroDest.trim();
    if (!from || !to) return;

    setHeroLaunching(true);
    setHeroOriginError("");
    setHeroDestError("");

    const [fromPlace, toPlace] = await Promise.all([
      resolvePlaceFromAutocomplete(from, heroOriginAcRef.current),
      resolvePlaceFromAutocomplete(to, heroDestAcRef.current),
    ]);

    let invalid = false;
    if (!fromPlace) {
      setHeroOriginError("Please enter a valid city, address, or landmark");
      invalid = true;
    }
    if (!toPlace) {
      setHeroDestError("Please enter a valid city, address, or landmark");
      invalid = true;
    }
    if (invalid) {
      setHeroLaunching(false);
      return;
    }

    const fromAddr = fromPlace.formattedAddress;
    const toAddr = toPlace.formattedAddress;
    setHeroOrigin(fromAddr);
    setHeroDest(toAddr);
    setOrigin(fromAddr);
    setDest(toAddr);
    if (heroOriginRef.current) heroOriginRef.current.value = fromAddr;
    if (heroDestRef.current) heroDestRef.current.value = toAddr;

    setView("app");
    window.scrollTo(0, 0);

    if (originRef.current) originRef.current.value = fromAddr;
    if (destRef.current) destRef.current.value = toAddr;

    const prefill = await buildFlowPrefillForUser();
    setFlowPrefill(prefill);
    setAnswers({});
    setConvoComplete(false);
    setGenerated(false);
    setQuestionHistory([]);
    setQIndex(-1);
    setCurrentQuestion(null);
    setTripLegs([]);
    setPrefDraft(null);
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    loadNextQuestion({}, { flowPrefill: prefill });
    setHeroLaunching(false);
    requestAnimationFrame(() => scrollPlanToTop());

    fetchDirections("Car");
  }

  function applyPrefDraftForQuestion(question, newAnswers, prefillOverride) {
    const prefillSource = prefillOverride || flowPrefill;
    if (!question) {
      setPrefDraft(null);
      return;
    }
    if (question.type === "trip_details" || question.type === "multiselect_group") {
      const draft = {};
      for (const sec of question.sections || []) {
        const fromAnswers = Array.isArray(newAnswers[sec.id]) ? newAnswers[sec.id] : [];
        const fromPrefill = Array.isArray(prefillSource[sec.id]) ? prefillSource[sec.id] : [];
        draft[sec.id] = fromAnswers.length ? fromAnswers : fromPrefill;
      }
      if (question.type === "trip_details") {
        draft.trip_budget = newAnswers.trip_budget || prefillSource.trip_budget || "No budget limit";
      }
      setPrefDraft(draft);
    } else if (question.type === "multiselect") {
      const fromAnswers = Array.isArray(newAnswers[question.id]) ? newAnswers[question.id] : [];
      const fromPrefill = Array.isArray(prefillSource[question.id]) ? prefillSource[question.id] : [];
      setPrefDraft(fromAnswers.length ? fromAnswers : fromPrefill);
    } else if (question.type === "party_composition") {
      setPrefDraft({
        adults: newAnswers.adult_count ?? prefillSource.adult_count ?? 2,
        children: newAnswers.child_count ?? prefillSource.child_count ?? 0,
      });
    } else {
      setPrefDraft(null);
    }
  }

  function loadNextQuestion(newAnswers, options = {}) {
    if (generateTripInFlightRef.current) return;
    if (convoComplete && !generated) return;
    try {
      const ctx = buildQuestionContext(newAnswers);
      const result = getNextFlowQuestion(newAnswers, ctx);
      if (!result || result.done) {
        setCurrentQuestion(null);
        setQIndex(-2);
        setConvoComplete(true);
        reAnswerFromEditRef.current = false;
        setAnswers(normalizeTripAnswers(newAnswers, ctx, { forGeneration: true }));
        return;
      }
      if (!result.id || !result.type) {
        console.error("loadNextQuestion: invalid question payload", result);
        toast_("Could not load the next question");
        return;
      }
      setCurrentQuestion(result);
      setQIndex(0);
      setConvoComplete(false);
      applyPrefDraftForQuestion(result, newAnswers, options.flowPrefill);
    } catch (err) {
      console.error("loadNextQuestion failed:", err);
      toast_(err.message || "Could not load the next question");
    }
  }

  function buildQuestionContext(newAnswers) {
    return {
      origin: origin?.trim() || routeInfo?.origin || "",
      destination: dest?.trim() || routeInfo?.destination || "",
      vehicle: newAnswers?.vehicle || routeInfo?.vehicleType || "Car",
      routeDistance: routeInfo?.distance,
      routeDuration: routeInfo?.duration,
      routeDistanceMiles: parseMilesFromDistance(routeInfo?.distance),
      routeDurationHours: parseHoursFromDuration(routeInfo?.duration),
      routeFailed: Boolean(routeError),
      routeErrorMessage: routeError || null,
    };
  }

  function retryRouteCalculation() {
    setRouteError(null);
    fetchDirections(getEffectiveVehicle(answers));
  }

  function handleSkipRoutePending() {
    if (!currentQuestion?.pendingRoute) return;
    const patch = { ...answersRef.current, route_context_unavailable: true };
    const ctx = buildQuestionContext(patch);
    const na = normalizeTripAnswers(patch, ctx);
    setAnswers(na);
    loadNextQuestion(na);
  }

  function handleRoutePendingTimeout() {
    if (answersRef.current.route_context_unavailable) return;
    setAnswers(prev => ({ ...prev, route_context_unavailable: true }));
  }

  function confirmContinuousDrive() {
    if (!continuousDriveConfirm) return;
    const { patch } = continuousDriveConfirm;
    setContinuousDriveConfirm(null);
    submitAnswer(OVERNIGHT_PREFERENCE_CONTINUOUS, {}, { patch, skipContinuousConfirm: true });
  }

  function cancelContinuousDrive() {
    setContinuousDriveConfirm(null);
  }

  useEffect(() => {
    if (generateTripInFlightRef.current) return;
    if (convoComplete) return;
    if (!currentQuestion?.pendingRoute) return;
    const ctx = buildQuestionContext(answersRef.current);
    if (isRouteContextReady(ctx) || ctx.routeFailed) {
      loadNextQuestion(answersRef.current);
    }
  }, [routeInfo?.distance, routeInfo?.duration, routeError, currentQuestion?.pendingRoute, currentQuestion?.id]);

  useEffect(() => {
    if (convoComplete || generated || !origin?.trim() || !dest?.trim()) return;
    if (answers.vehicle && routeInfo?.distance) return;
    fetchDirections(answers.vehicle || "Car");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, dest, answers.vehicle, generated, convoComplete]);

  useEffect(() => {
    if (view !== "app" || generated || convoComplete || qIndex !== -1) return;
    if (!origin?.trim() || !dest?.trim()) return;
    loadNextQuestion({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, origin, dest, generated, convoComplete, qIndex]);

  function getStepMessage() {
    if (qIndex === -2) {
      const completeMsg = getFlowCompleteMessage(answers, buildQuestionContext(answers));
      if (completeMsg) return completeMsg;
      return "Got it. Ready to generate your trip plan?";
    }
    if (currentQuestion) return currentQuestion.ask;
    return null;
  }

  function submitAnswer(value, extraFields = {}, options = {}) {
    const activeQuestion = options.question || currentQuestion;
    if (!activeQuestion) return;
    try {
      let patch = options.patch;
      if (!patch) {
        if (activeQuestion.type === "trip_details" && value && typeof value === "object" && !Array.isArray(value)) {
          patch = { ...answers, ...extraFields, ...value };
        } else if (activeQuestion.type === "multiselect_group" && value && typeof value === "object" && !Array.isArray(value)) {
          patch = { ...answers, ...extraFields, ...value };
        } else if (activeQuestion.type === "lodging_stay") {
          patch = { ...answers, ...extraFields, lodging: value };
        } else if (activeQuestion.type === "party_composition" && value && typeof value === "object") {
          patch = {
            ...answers,
            ...extraFields,
            adult_count: value.adults,
            child_count: value.children,
          };
        } else {
          patch = { ...answers, ...extraFields, [activeQuestion.id]: value };
        }
      }

      if (
        !options.skipContinuousConfirm
        && activeQuestion.id === "overnight_preference"
        && value === OVERNIGHT_PREFERENCE_CONTINUOUS
      ) {
        const warn = warnContinuousDriveFeasibility(buildQuestionContext(patch));
        if (warn) {
          setContinuousDriveConfirm({ patch, warn });
          return;
        }
      }

      const ctx = buildQuestionContext(patch);
      if (activeQuestion.id === "overnight_preference" && !isRouteContextReady(ctx) && !ctx.routeFailed) {
        patch.route_context_unavailable = true;
      }

      let na = normalizeTripAnswers(patch, ctx);
      const fromSummaryEdit = reAnswerFromEditRef.current;
      const shouldPruneStale = (
        fromSummaryEdit
        || activeQuestion.id === "vehicle"
        || activeQuestion.id === "primary_vehicle"
        || activeQuestion.id === "multi_vehicles"
        || activeQuestion.id === "travelers"
        || activeQuestion.id === "overnight_preference"
        || activeQuestion.type === "trip_details"
      );
      if (shouldPruneStale) {
        na = pruneStaleBranchAnswers(na, ctx);
      }

      const prevVal = answers[activeQuestion.id];
      if (prevVal !== undefined) {
        answerChangeCountsRef.current = recordAnswerChange(
          answerChangeCountsRef.current,
          activeQuestion.id,
          prevVal,
          value,
        );
      }

      setAnswers(na);
      if (activeQuestion.id !== "_route_loading") {
        const historyQuestion = activeQuestion.type === "lodging_stay"
          ? { ...activeQuestion, _loyalty: extraFields.loyalty_program || "No preference" }
          : activeQuestion;
        setQuestionHistory(h => [...h, { question: historyQuestion, answer: value }]);
      }
      loadNextQuestion(na);
      if (activeQuestion.id === "vehicle" && originRef.current?.value && destRef.current?.value) {
        fetchDirections(na.vehicle);
      }
      if (activeQuestion.id === "fuel_type" && originRef.current?.value && destRef.current?.value) {
        fetchDirections(getEffectiveVehicle(na));
      }
      if (activeQuestion.id === "preferences" && originRef.current?.value && destRef.current?.value && na.vehicle) {
        fetchDirections(getEffectiveVehicle(na));
      }
    } catch (err) {
      console.error("submitAnswer failed:", err);
      toast_(err.message || "Could not save your answer");
    }
  }

  function pickAnswer(value, extraFields, options = {}) {
    if (stepAnim || !currentQuestion?.id) return;
    const instant = options.instant ?? (
      currentQuestion.type === "multiselect"
      || currentQuestion.type === "multiselect_group"
      || currentQuestion.type === "trip_details"
      || currentQuestion.type === "lodging_stay"
      || currentQuestion.type === "party_composition"
      || currentQuestion.type === "text"
    );
    const TAP_DELAY_MS = 80;
    const STEP_ANIM_MS = 320;
    try {
      if (instant) {
        submitAnswer(value, extraFields);
        return;
      }
      setEnterAnim(false);
      const answerKey = typeof value === "string" ? value : "selected";
      setStepAnim({ answer: answerKey, phase: "selected" });
      if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
      stepAnimTimer.current = setTimeout(() => {
        setStepAnim({ answer: answerKey, phase: "exit" });
        stepAnimTimer.current = setTimeout(() => {
          try {
            submitAnswer(value, extraFields);
            setStepAnim(null);
          } catch (err) {
            console.error("pickAnswer failed:", err);
            setStepAnim(null);
            toast_(err.message || "Could not save your answer");
          }
        }, STEP_ANIM_MS);
      }, TAP_DELAY_MS);
    } catch (err) {
      console.error("pickAnswer failed:", err);
      setStepAnim(null);
      toast_(err.message || "Could not save your answer");
    }
  }

  useEffect(() => () => { if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current); }, []);

  useEffect(() => {
    if (!helpMenuOpen) return;
    const onPointerDown = (e) => {
      if (helpWrapRef.current?.contains(e.target)) return;
      setHelpMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [helpMenuOpen]);

  const getDepartureTime = useCallback(() => {
    if (timingMode === "leave_now") return new Date();
    if (timingMode === "arrive_by" && arriveByDate && routeInfo?.duration) {
      const hours = parseHoursFromDuration(routeInfo.duration);
      const arrive = new Date(arriveByDate);
      if (!Number.isNaN(arrive.getTime()) && hours) {
        return new Date(arrive.getTime() - hours * 3600000);
      }
    }
    return new Date();
  }, [timingMode, arriveByDate, routeInfo]);

  const departureTime = useMemo(() => getDepartureTime(), [getDepartureTime]);

  const dayRoutePaths = useMemo(() => {
    if (!generated || !routeInfo?.routePoints?.length) return [];
    const overnightCount = Math.max(1, stops.filter(s => s.city).length);
    return computeDayRoutePaths(routeInfo.routePoints, overnightCount);
  }, [generated, routeInfo, stops]);

  const focusMapOnStop = useCallback((item) => {
    if (item?.lat == null || item?.lng == null) return;
    setMapFocusTarget({
      id: item.id || `focus-${item.lat}-${item.lng}`,
      lat: item.lat,
      lng: item.lng,
      category: item.type === "overnight" ? "lodging" : "poi",
      title: item.title || item.name,
      subtitle: item.city || item.description || "",
      _ts: Date.now(),
    });
  }, []);

  function handleResultsStopSelect(stop) {
    if (!stop) return;
    const id = stop.id || `focus-${stop.lat}-${stop.lng}`;
    highlightStop(id);
    if (generated && itinerarySync.itineraryWaypoints.length) {
      itinerarySync.handleNavigateToStop(stop);
      return;
    }
    if (stop.lat == null || stop.lng == null) return;
    focusMapOnStop({ ...stop, id });
    if (resultsView === "itinerary") {
      setResultsView("map");
    }
  }

  function addFuelStopToTrip(roadStop) {
    setRoadStops(prev => [...prev, roadStop]);
  }

  function isRoadStopAdded(stop) {
    const id = stop?.id || stop?.stopData?.id;
    if (generated && itinerarySync.itineraryWaypoints.length && id) {
      return itinerarySync.isWaypointIncluded(id);
    }
    const normalized = normalizeRoadStopEntry(stop?.stopData || stop);
    if (!normalized) return false;
    const key = roadStopKey(normalized);
    return roadStops.some(s => s.userAdded && (s.id === normalized.id || roadStopKey(s) === key));
  }

  function addRoadStopToTrip(stop) {
    const normalized = normalizeRoadStopEntry(stop);
    if (!normalized) return;
    if (generated && itinerarySync.itineraryWaypoints.length) {
      const existing = itinerarySync.itineraryWaypoints.find(w => w.id === normalized.id);
      if (existing) {
        itinerarySync.handleToggleIncluded(existing.id, true);
      } else {
        itinerarySync.handleAddStop({
          id: normalized.id || roadStopKey(normalized),
          title: normalized.name || normalized.location,
          city: normalized.location || normalized.city,
          lat: normalized.lat,
          lng: normalized.lng,
          category: normalized.category,
          description: normalized.note || normalized.amenities || "A stop along your route.",
          action: "add",
          stopData: normalized,
        });
      }
      toast_("Added to trip", {
        actionLabel: "Undo",
        onAction: () => removeRoadStopFromTrip({ ...normalized, stopData: normalized }),
      });
      if (user && session?.access_token) {
        void recordUserStopPreferences(session.access_token, [normalized]);
      }
      return;
    }
    const key = roadStopKey(normalized);
    setRoadStops(prev => {
      const existingIdx = prev.findIndex(s => s.id === normalized.id || roadStopKey(s) === key);
      if (existingIdx >= 0) {
        if (prev[existingIdx].userAdded) return prev;
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], userAdded: true };
        return next;
      }
      const entry = { ...normalized, id: normalized.id || key, userAdded: true };
      if (entry.lat != null && entry.lng != null) {
        setMapMarkers(markers => {
          if (markers.some(m => m.id === entry.id || roadStopKey(m) === key)) return markers;
          return [
            ...markers,
            {
              id: entry.id,
              lat: entry.lat,
              lng: entry.lng,
              category: "poi",
              title: entry.name || entry.title,
              subtitle: entry.location || entry.city || "",
              action: "add",
            },
          ];
        });
      }
      return [...prev, entry];
    });
    toast_("Added to trip", {
      actionLabel: "Undo",
      onAction: () => removeRoadStopFromTrip({ ...normalized, stopData: normalized }),
    });
    if (user && session?.access_token) {
      void recordUserStopPreferences(session.access_token, [normalized]);
    }
  }

  function removeRoadStopFromTrip(stop) {
    const normalized = normalizeRoadStopEntry(stop?.stopData || stop);
    if (!normalized) return;
    const id = stop?.id || normalized.id || roadStopKey(normalized);
    if (generated && itinerarySync.itineraryWaypoints.length) {
      itinerarySync.handleToggleIncluded(id, false);
      return;
    }
    const key = roadStopKey(normalized);
    setRoadStops(prev => {
      const idx = prev.findIndex(s => s.id === normalized.id || roadStopKey(s) === key);
      if (idx < 0) return prev;
      const target = prev[idx];
      if (target.userAdded) {
        const next = [...prev];
        next[idx] = { ...target, userAdded: false };
        return next;
      }
      return prev.filter((_, i) => i !== idx);
    });
  }

  function addLodgingSelection(lodging) {
    setSelectedLodging(prev => {
      const exists = prev.some(l => l.id === lodging.id);
      if (exists) return prev.filter(l => l.id !== lodging.id);
      return [...prev, lodging];
    });
  }

  useEffect(() => {
    if (!routeInfo?.routePoints?.length) {
      setNightSegmentPaths([]);
      setLowFuelSegmentPaths([]);
      return;
    }
    const hours = parseHoursFromDuration(routeInfo.duration);
    const dep = getDepartureTime();
    const nightBlocks = computeNightDrivingBlocks(dep, hours, routeInfo.routePoints);
    setNightSegmentPaths(nightBlocks.map(b => b.path).filter(p => p?.length > 1));
    const totalMiles = parseMilesFromDistance(routeInfo.distance);
    setLowFuelSegmentPaths(
      computeLowFuelSegmentPath(routeInfo.routePoints, [], getFuelRangeMiles(answers), totalMiles),
    );
  }, [routeInfo, answers, getDepartureTime]);

  async function enrichAndSetTrip(parsedStops, parsedRoadStops, normalizedAnswers, routeInfoOverride = null) {
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
      });
      if (enrichController.signal.aborted) return null;
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
    setEnrichingTrip(false);
    toast_("Enrichment cancelled — basic trip data is still shown.");
  }

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

  async function generateTrip() {
    if (!user) {
      openAuthModal("signup");
      return;
    }

    const tripOrigin = originRef.current?.value?.trim() || origin;
    const tripDest = destRef.current?.value?.trim() || dest;

    let status = user
      ? (creditStatusRef.current || creditStatus)
      : getGuestCreditStatus();
    if (!user) {
      applyCreditStatus(status);
    }

    const guard = canStartTripGeneration({
      inFlight: generateTripInFlightRef.current,
      origin: tripOrigin,
      dest: tripDest,
      convoComplete,
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

    const applyGeneratedTrip = (parsed, activeRouteInfo, { tips, mergedRoadStops }) => {
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
      void enrichAndSetTrip(parsed.stops, mergedRoadStops, normalizedAnswers, activeRouteInfo);
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
      });
      normalizedAnswers = stripAnswersForSonnet(normalizedAnswers);
      const answerGaps = detectAnswerGaps(normalizedAnswers);
      const tripsForContext = user ? savedTripsRef : [];
      const recentTripsContext = buildRecentTripsContext(tripsForContext, 3);
      const userTravelPatterns = buildUserPatternSummary(tripsForContext);
      const recentTripsPreferencesRollup = buildRecentTripsPreferencesRollup(tripsForContext, 3);
      const travelerDossier = buildTravelerDossier(tripsForContext, normalizedAnswers);
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
      if (isLoaded && window.google && activeRouteInfo.routePoints?.length) {
        setGenerationStream(buildGenerationPrepProgress("places", {
          cityNames: activeRouteInfo.citiesAlongRoute || [],
        }));
        placesContext = await buildPlacesContext(normalizedAnswers, activeRouteInfo);
        placesContextPrompt = formatPlacesContextForPrompt(placesContext);
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
        userTravelPatterns,
        answerConfidenceNotes,
        gracefulDegradationNotes,
        fallbackPreferences: userPrefs
          ? resolveAnswersWithFallback({}, userPrefs, { planPrefs: planPreferencesRef.current })
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

          applyGeneratedTrip(parsed, activeRouteInfo, { tips, mergedRoadStops });

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
          } else {
            setGuestTripPendingSave(true);
            const guestStatus = getGuestCreditStatus();
            applyCreditStatus(guestStatus);
            if (guestStatus.remaining <= 0) {
              setTimeout(() => openTripsUpgrade({ limitReached: false }), 1200);
            }
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
          if (err.name === "AbortError" || err.code === "no_credits") throw err;
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
        openAuthModal("signin");
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
        if (!user) refundGuestCredit();
        ensurePayoffScreen();
        return;
      }
      if (!user) refundGuestCredit();
      applyCreditStatus(getGuestCreditStatus());
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

  function requestResetPlan() {
    setConfirmResetOpen(true);
  }

  function resetPlan() {
    setConfirmResetOpen(false);
    setTripUsedFallback(false);
    setGenerationError(null);
    setSavedPlanSnapshot(null);
    setReturnedFromResults(false);
    setGuestTripPendingSave(false);
    setAnswers({});
    buildFlowPrefillForUser().then(setFlowPrefill);
    setQIndex(-1);
    setCurrentQuestion(null); setQuestionHistory([]);
    setConvoComplete(false); setGenerated(false); setStops([]); setTripTips([]); setPersonalTouches([]); setChangesMade([]); setEnrichingTrip(false); setEnrichmentLimited(false); setEnrichmentNoticeDismissed(false); setRoadStops([]); setTripFormat(null); setRecommendations([]); setSelectedLodging([]);
    setTripLegs([]); setPrefDraft([]);
    setTripAlerts([]); setDismissedAlerts([]); setMapMarkers([]); setCustomStops([]);
    setActivitiesByCity({}); setOptionalStopCards([]);
    setRestaurantsByCity({});
    setWeatherByCity({});
    setRouteOptimized(false);
    setNightSegmentPaths([]); setLowFuelSegmentPaths([]);
    setActiveDayIndex(0); setMapFocusTarget(null);
    setResultsView("planning");
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    clearSavedPlanDraft();
  }

  function dismissTripAlert(alertId) {
    setDismissedAlerts(prev => [...prev, alertId]);
    setMapMarkers(prev => prev.filter(m => m.alertId !== alertId));
  }

  async function handleShareItinerary() {
    const link = createItineraryShareLink({
      origin, dest, stops, roadStops, tripTips, answers, routeInfo, selectedLodging,
    });
    if (!link) {
      toast_("Could not create share link", { isError: true });
      return;
    }
    const { ok } = await copyToClipboard(link);
    if (ok) toast_("Safety trip link copied — send to a trusted contact", true);
    else toast_("Could not copy — open Share and copy the link manually.", { isError: true, duration: 8000 });
  }

  function handleOpenCollaborate() {
    if (!user) {
      openAuthModal("signup");
      return;
    }
    setShowCollabPanel(true);
  }

  function handleRegenerateWithGroup(collaboration) {
    collaborationHintsRef.current = formatCollaborationHints(collaboration, stops);
    setShowCollabPanel(false);
    toast_("Regenerating trip with group input…");
    void generateTrip().finally(() => {
      collaborationHintsRef.current = "";
    });
  }

  const tripCollabSnapshot = useMemo(() => ({
    origin,
    dest,
    destination: dest,
    stops,
    roadStops,
    tripTips,
    answers,
    routeInfo,
    selectedLodging,
  }), [origin, dest, stops, roadStops, tripTips, answers, routeInfo, selectedLodging]);

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("share");
    if (!shareId) return;
    const shared = loadSharedItinerary(shareId);
    if (!shared) {
      toast_(
        "This share link only works on the device that created it. Sign in to save trips across devices.",
        { isError: true, duration: 10000 },
      );
      return;
    }
    setView("app");
    setOrigin(shared.origin || "");
    setDest(shared.dest || "");
    setStops(shared.stops || []);
    setRoadStops(shared.roadStops || []);
    setTripTips(shared.tripTips || []);
    setPersonalTouches(shared.personalTouches || []);
    setChangesMade(shared.changesMade || []);
    setAnswers(stripSessionOnlyAnswers(shared.answers || {}));
    setSelectedLodging(shared.selectedLodging || []);
    setGenerated(true);
    setResultsView("itinerary");
    setConvoComplete(true);
    setTab("plan");
    setMapMarkers(stopsToMapMarkers(shared.stops || [], shared.roadStops || [], [], [], answers));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!generated) return;
    const budget = computeBudgetEstimate(answers, routeInfo, tripLegs, { roadStops, selectedLodging, restaurantsByCity });
    setTripAlerts(prev => {
      const base = prev.filter(a => a.type !== "budget");
      const cap = getTripBudgetCap(answers);
      const budgetAlerts = [];
      if (cap != null && budget.total != null) {
        if (budget.total > cap) {
          budgetAlerts.push({
            id: "alert-budget-exceeded",
            type: "budget",
            title: "Budget exceeded",
            message: `Estimated total $${Math.round(budget.total)} exceeds your $${cap} budget limit.`,
            mapCategory: "budget",
          });
        } else if (cap - budget.total <= 50) {
          budgetAlerts.push({
            id: "alert-budget-warning",
            type: "budget",
            title: "Budget warning",
            message: `Within $50 of your $${cap} budget limit.`,
            mapCategory: "budget",
          });
        }
      }
      return consolidateAndCapAlerts([...base, ...budgetAlerts]);
    });
  }, [generated, answers, routeInfo, tripLegs, roadStops, selectedLodging, restaurantsByCity]);

  function clearSavedPlanDraft() {
    clearPlanDraft();
    setPlanDraft(null);
  }

  function resumePlanDraft() {
    const draft = loadPlanDraft();
    if (!draft?.origin || !draft?.dest) return;

    setOrigin(draft.origin);
    setDest(draft.dest);
    if (originRef.current) originRef.current.value = draft.origin;
    if (destRef.current) destRef.current.value = draft.dest;

    setAnswers(draft.answers || {});
    setQuestionHistory(draft.questionHistory || []);
    setConvoComplete(!!draft.convoComplete);
    setGenerated(false);
    setReturnedFromResults(false);
    setView("app");
    setTab("plan");
    setCardCollapsed(false);
    setResultsView("planning");

    if (draft.convoComplete) {
      setQIndex(-2);
      setCurrentQuestion(null);
    } else if (draft.currentQuestion?.id) {
      const ctx = buildQuestionContext(draft.answers || {});
      const normalized = normalizeTripAnswers(draft.answers || {}, ctx);
      setAnswers(normalized);
      setCurrentQuestion(draft.currentQuestion);
      setQIndex(0);
      setConvoComplete(false);
      applyPrefDraftForQuestion(draft.currentQuestion, normalized);
    } else {
      loadNextQuestion(draft.answers || {});
    }

    window.scrollTo(0, 0);
    requestAnimationFrame(() => scrollPlanToTop());
    fetchDirections(draft.answers?.vehicle || "Car");
  }

  function revertAnswerForHistoryEntry(newAnswers, entry) {
    const out = { ...newAnswers };
    const q = entry.question;
    delete out[q.id];
    if (q.id === "travelers") {
      delete out.kids_ages;
      delete out.adult_count;
      delete out.child_count;
    }
    if (q.id === "party_composition") {
      delete out.adult_count;
      delete out.child_count;
    }
    if (q.id === "vehicle") {
      delete out.fuel_type;
      delete out.towing;
      delete out.truck_height;
      delete out.truck_weight;
      delete out.truck_hazmat;
      delete out.hos_compliance;
      delete out.rv_height;
      delete out.rv_weight;
      delete out.rv_towing;
      delete out.multi_vehicles;
      delete out.primary_vehicle;
      delete out.coordination_needs;
      delete out.effective_vehicle;
      delete out.overnight_preference;
      delete out.continuous_drive;
      delete out.lodging;
      delete out.loyalty_program;
      delete out.trip_details;
      delete out.trip_details_defaults_confirmed;
      delete out.food_allergies;
      delete out.kids_ages;
      delete out.schedule_drive_hours;
    }
    if (q.id === "overnight_preference") {
      delete out.continuous_drive;
      delete out.lodging;
      delete out.loyalty_program;
      delete out.trip_nights;
    }
    if (q.id === "lodging" || q.type === "lodging_stay") {
      delete out.lodging;
      delete out.loyalty_program;
      delete out.trip_nights;
    }
    if (q.id === "sleeper_cab") {
      delete out.lodging;
    }
    if (q.type === "multiselect_group" || q.type === "trip_details") {
      for (const sec of q.sections || []) {
        delete out[sec.id];
      }
      if (q.type === "trip_details") {
        delete out.trip_budget;
        delete out.trip_details_defaults_confirmed;
        delete out.food_allergies;
        delete out.kids_ages;
        delete out.schedule_drive_hours;
      }
    }
    if (q.id === "kids_ages") {
      delete out.kids_ages;
    }
    return out;
  }

  function jumpToQuestion(questionId) {
    if (stepAnim || !questionId) return;
    const idx = questionHistory.findIndex(h => h.question?.id === questionId);
    if (idx < 0) return;

    reAnswerFromEditRef.current = true;

    let newAnswers = { ...answers };
    let history = [...questionHistory];
    while (history.length > idx) {
      newAnswers = revertAnswerForHistoryEntry(newAnswers, history.pop());
    }
    const target = questionHistory[idx];
    newAnswers = revertAnswerForHistoryEntry(newAnswers, target);
    history = questionHistory.slice(0, idx);

    setAnswers(newAnswers);
    setQuestionHistory(history);
    setCurrentQuestion(target.question);
    setQIndex(0);
    setConvoComplete(false);
    setReturnedFromResults(true);
    setGenerated(false);
    setStepAnim(null);

    if (target.question.type === "trip_details" || target.question.type === "multiselect_group") {
      setPrefDraft(target.answer && typeof target.answer === "object" ? target.answer : {});
    } else if (target.question.type === "multiselect") {
      setPrefDraft(Array.isArray(target.answer) ? target.answer : []);
    } else {
      setPrefDraft(null);
    }
    scrollPlanToTop();
  }

  function applyGoBackOneQuestion() {
    const history = [...questionHistory];
    const last = history.pop();
    const newAnswers = revertAnswerForHistoryEntry(answers, last);
    if (last.question.type === "multiselect_group" || last.question.type === "trip_details") {
      setPrefDraft(last.answer && typeof last.answer === "object" ? last.answer : {});
    } else if (last.question.type === "multiselect") {
      setPrefDraft(Array.isArray(last.answer) ? last.answer : []);
    } else {
      setPrefDraft(null);
    }
    setAnswers(newAnswers);
    setQuestionHistory(history);
    setCurrentQuestion(last.question);
    setQIndex(0);
    setConvoComplete(false);
  }

  function goBackOneQuestion() {
    if (questionHistory.length === 0 || stepAnim) return;
    const STEP_ANIM_MS = 320;
    setEnterAnim(false);
    setStepAnim({ answer: null, phase: "exit" });
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    stepAnimTimer.current = setTimeout(() => {
      applyGoBackOneQuestion();
      setStepAnim(null);
    }, STEP_ANIM_MS);
  }

  const planPanelHelpButton = (
    <PlanPanelHelpButton
      open={helpMenuOpen}
      onToggle={() => setHelpMenuOpen(o => !o)}
      onHelpCenter={() => {
        window.open("https://tripmappa.com/help", "_blank");
        setHelpMenuOpen(false);
      }}
      onReportIssue={() => {
        setModal({ type: "report" });
        setHelpMenuOpen(false);
      }}
      onMapTips={() => {
        toast_("Map controls: use Map for style, +/− to zoom, and the target icon to recenter.", true);
        setHelpMenuOpen(false);
      }}
      wrapRef={helpWrapRef}
    />
  );

  function handleViewTrip(trip) {
    const tripAnswers = stripSessionOnlyAnswers(trip.answers || {});
    setOrigin(trip.origin);
    setDest(trip.dest);
    setStops(trip.stops || []);
    setRoadStops(trip.roadStops || []);
    setTripTips(trip.tripTips || []);
    setPersonalTouches(trip.personalTouches || []);
    setChangesMade(trip.changesMade || []);
    setAnswers(tripAnswers);
    setRouteInfo(trip.routeInfo || null);
    setSelectedLodging(trip.selectedLodging || []);
    setGenerated(true);
    setResultsView("itinerary");
    setConvoComplete(true);
    setTab("plan");
    setView("app");
    setTripUsedFallback(false);
    const normalized = normalizeTripAnswers(tripAnswers, buildQuestionContext(tripAnswers));
    if (trip.routeInfo?.routePoints?.length) {
      enrichAndSetTrip(trip.stops || [], trip.roadStops || [], normalized);
    } else {
      setMapMarkers(stopsToMapMarkers(trip.stops || [], trip.roadStops || [], [], [], tripAnswers));
      if (isLoaded && window.google && trip.origin && trip.dest) {
        fetchDirections(getEffectiveVehicle(tripAnswers)).then(() => {
          enrichAndSetTrip(trip.stops || [], trip.roadStops || [], normalized);
        });
      }
    }
    toast_("Trip loaded");
  }

  async function retryEnrichment() {
    if (!generated) return;
    const normalized = normalizeTripAnswers(answers, buildQuestionContext(answers), { forGeneration: true });
    setEnrichmentNoticeDismissed(false);
    await enrichAndSetTrip(stops, roadStops, normalized);
  }

  if (AppRoutePage) {
    return <AppRoutePage />;
  }

  if (liveShareToken) {
    return <LazyLiveViewPage shareToken={liveShareToken} toast={toast_} />;
  }

  if (view === "preferences" && user) {
    return (
      <>
        <div className={`app-wrap ${theme} profile-view-wrap`}>
          {renderAppNavBar("app")}
          <ErrorBoundary label="preferences" title="Could not show preferences">
            <LazyUserPreferencesPage
              accessToken={session?.access_token}
              onBack={() => setView("profile")}
              onToast={toast_}
              onSaved={(prefs, meta) => applyPlanPreferencesSaved(prefs, meta)}
            />
          </ErrorBoundary>
        </div>
        <Toast
          message={toast}
          isGold={toastIsGold}
          isError={toastIsError}
          actionLabel={toastAction?.label}
          onAction={toastAction?.onClick}
        />
      </>
    );
  }

  if (view === "profile" && user) {
    return (
      <>
        <div className={`app-wrap ${theme} profile-view-wrap`}>
          {renderAppNavBar("app")}
          <ErrorBoundary label="profile" title="Could not show profile">
          <LazyProfilePage
            theme={theme}
            user={user}
            profile={userProfile}
            creditStatus={creditStatus}
            savedTrips={savedTrips}
            generationCount={planGenerationCount}
            isLoaded={isLoaded}
            onBack={() => setView("app")}
            onSignOut={handleSignOut}
            onUpgrade={openTripsUpgrade}
            onUpgradeVoyager={openVoyagerUpgrade}
            onUpgradeTraveler={openGroceryUpgrade}
            onPlanTrip={() => { setView("app"); setTab("plan"); setCardCollapsed(false); }}
            onLoadTrip={handleViewTrip}
            onDeleteTrip={requestDeleteSavedTrip}
            onSaveDisplayName={handleProfileSaveDisplayName}
            onSaveHomeAddress={async (addr) => {
              const profile = await saveHomeAddress(user.id, addr);
              setUserProfile(profile);
              setHomeAddress(addr);
            }}
            onSaveEmergencyContact={async (phone) => {
              const profile = await saveEmergencyContact(user.id, phone);
              setUserProfile(profile);
            }}
            onSaveNotifications={handleProfileSaveNotifications}
            onUploadAvatar={handleProfileUploadAvatar}
            onUpdateEmail={updateEmail}
            onUpdatePassword={updatePassword}
            onManageSubscription={handleManageSubscription}
            onOpenPreferences={openProfilePreferences}
            toast={toast_}
            scrollToSection={profileScrollTo}
          />
          </ErrorBoundary>
        </div>
        {showUpgradeModal && (
          <LazyUpgradeModal
            onClose={() => setShowUpgradeModal(false)}
            onOpenPricing={openPricingPage}
            user={user}
            accessToken={session?.access_token}
            creditStatus={creditStatus}
            reason={upgradeModalReason}
            resetDate={upgradeModalResetDate}
            initialPlan={upgradeModalInitialPlan ?? TIERS.TRAILBLAZER}
            initialBillingInterval={upgradeModalBillingInterval}
            onSignUp={() => { setShowUpgradeModal(false); openAuthModal("signup"); }}
            onCheckoutError={msg => toast_(msg, { isError: true })}
          />
        )}
        <Toast
          message={toast}
          isGold={toastIsGold}
          isError={toastIsError}
          actionLabel={toastAction?.label}
          onAction={toastAction?.onClick}
        />
      </>
    );
  }

  if (view === "hero") return (
    <>
      <HeroView
        isLoaded={isLoaded}
        heroOrigin={heroOrigin}
        heroDest={heroDest}
        heroOriginError={heroOriginError}
        heroDestError={heroDestError}
        heroLaunching={heroLaunching}
        launchDisabled={!heroOrigin.trim() || !heroDest.trim() || !isLoaded || heroLaunching}
        heroOriginRef={heroOriginRef}
        heroDestRef={heroDestRef}
        user={user}
        onSwap={swapHeroCities}
        onHeroOriginAcLoad={ac => { heroOriginAcRef.current = ac; }}
        onHeroDestAcLoad={ac => { heroDestAcRef.current = ac; }}
        onHeroOriginPlaceChanged={() => {
          if (heroOriginRef.current) setHeroOrigin(heroOriginRef.current.value);
          setHeroOriginError("");
          captureHeroOriginCoordsFromAutocomplete();
        }}
        onHeroDestPlaceChanged={() => {
          if (heroDestRef.current) setHeroDest(heroDestRef.current.value);
          setHeroDestError("");
        }}
        onHeroOriginChange={v => { setHeroOrigin(v); setHeroOriginError(""); }}
        onHeroDestChange={v => { setHeroDest(v); setHeroDestError(""); }}
        onLaunch={launchFromHero}
        onGoHome={goHome}
        activeNav={null}
        onOpenPlan={handleNavOpenPlan}
        onOpenTrips={handleNavOpenTrips}
        onOpenShare={handleNavOpenShare}
        onOpenProfile={openProfile}
        onRefreshCredits={refreshCredits}
        onUploadAvatar={handleProfileUploadAvatar}
        onGetStarted={() => openAuthModal("signup")}
        onSignIn={() => openAuthModal("signin")}
        onSignOut={handleSignOut}
        userProfile={userProfile}
        creditStatus={creditStatus}
        planDraft={planDraft}
        onResumeDraft={resumePlanDraft}
        onDismissDraft={clearSavedPlanDraft}
        heroExploreEnabled={heroExploreEnabled}
        heroExploreDriveSeconds={heroExploreDriveSeconds}
        heroExploreLoading={heroExploreLoading}
        heroExploreError={heroExploreError}
        heroExplorePolygon={heroExplorePolygon}
        heroExploreCenter={heroOriginCoords}
        heroTheme={theme}
        onHeroExploreToggle={handleHeroExploreToggle}
        onHeroExploreDriveTimeChange={handleHeroExploreDriveTimeChange}
        onHeroExploreMapClick={handleHeroExploreMapClick}
        onHeroExplorePlaceSelect={handleHeroExplorePlaceSelect}
      />
      {founderWelcomeName && (
        <LazyFounderWelcomeOverlay
          firstName={founderWelcomeName}
          onDismiss={() => setFounderWelcomeName(null)}
        />
      )}
      {authModal === "signup" && (
        <LazyEmailModal
          email={heroEmail}
          onEmailChange={setHeroEmail}
          onClose={() => setAuthModal(null)}
          onSignUp={handleEmailSignUp}
          onSwitchToSignIn={() => openAuthModal("signin")}
          onContinueWithPhone={() => { setAuthModal(null); openLazyPhoneModal(); }}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
          theme={theme}
        />
      )}
      {authModal === "phone" && (
        <LazyPhoneModal
          onClose={() => { setAuthModal(null); setAuthPhone(""); setAuthError(""); }}
          onSendCode={handlePhoneSendCode}
          onVerifyCode={handlePhoneVerify}
          onResendCode={handlePhoneResend}
          initialPhone={authPhone}
          loading={authBusy}
          error={authError}
          theme={theme}
        />
      )}
      {authModal === "signin" && (
        <LazySignInModal
          onClose={() => setAuthModal(null)}
          onSignIn={handleSignInSubmit}
          onForgotPassword={handleForgotPassword}
          onSwitchToSignup={() => openAuthModal("signup")}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
          theme={theme}
        />
      )}
      {!isAuthConfigured && authModal?.startsWith("oauth-") && (
        <LazyOAuthComingSoonModal
          provider={authModal.replace("oauth-", "")}
          onClose={() => setAuthModal(null)}
          onUseEmail={() => openAuthModal("signup")}
          theme={theme}
        />
      )}
      <Toast
        message={toast}
        isGold={toastIsGold}
        isError={toastIsError}
        actionLabel={toastAction?.label}
        onAction={toastAction?.onClick}
      />
      {founderWelcomeName && (
        <LazyFounderWelcomeOverlay
          firstName={founderWelcomeName}
          onDismiss={() => setFounderWelcomeName(null)}
        />
      )}
    </>
  );

  return (
    <>
      <div className={`app-wrap ${theme}${generated && resultsView === "itinerary" ? " results-fullscreen" : ""}${generated && resultsView === "map" ? " map-fullscreen-mode" : ""}`} style={{
        display: "flex", flexDirection: "column", height: "100vh",
        transition: "color 1.8s ease",
      }}>
        {loading && (
          <LazyGenerationStreamOverlay
            progress={generationStream}
            origin={origin}
            dest={dest}
            vehicleType={getEffectiveVehicle(answers)}
            theme={theme}
            routeCities={routeInfo?.citiesAlongRoute || []}
          />
        )}
        {renderAppNavBar("app")}
        <ConfigWarningBanner missing={configMissing} />

        {generated && resultsView === "itinerary" ? (
          <ErrorBoundary
            key={resultsBoundaryKey}
            label="results"
            title="Could not show trip results"
            onRetry={() => setResultsBoundaryKey(k => k + 1)}
          >
            <LazyTripResultsPanel
            theme={theme}
            origin={origin}
            dest={dest}
            answers={answers}
            stops={stops}
            roadStops={roadStops}
            routeInfo={routeInfo}
            tripLegs={tripLegs}
            tripFormat={tripFormat}
            recommendations={recommendations}
            selectedLodging={selectedLodging}
            tripAlerts={tripAlerts.filter(a => !dismissedAlerts.includes(a.id))}
            liveTripTips={displayLiveTips}
            tripTips={tripTips}
            onAcceptActionTip={handleAcceptActionTip}
            onDismissActionTip={handleDismissActionTip}
            dismissedActionTipIds={dismissedActionTipIds}
            personalTouches={personalTouches}
            changesMade={changesMade}
            liveTipsUpdatedAt={liveTipsUpdatedAt}
            liveTipsRefreshing={liveTipsRefreshing}
            enrichingTrip={enrichingTrip}
            enrichmentLimited={enrichmentLimited && !enrichmentNoticeDismissed}
            planOutOfDate={planOutOfDate}
            planChanges={planChanges}
            onRegenerateTrip={generateTrip}
            generateLoading={loading}
            onCancelEnrichment={cancelEnrichment}
            onDismissEnrichmentNotice={() => setEnrichmentNoticeDismissed(true)}
            onRetryEnrichment={retryEnrichment}
            tripUsedFallback={tripUsedFallback}
            isStopAdded={isRoadStopAdded}
            activitiesByCity={activitiesByCity}
            restaurantsByCity={restaurantsByCity}
            weatherByCity={weatherByCity}
            routeOptimized={routeOptimized}
            optionalStopCards={optionalStopCards}
            departureTime={departureTime}
            timingMode={timingMode}
            arriveByDate={arriveByDate}
            activeDayIndex={activeDayIndex}
            highlightedStopId={highlightedStopId}
            showGuestBanner={!user && !guestBannerDismissed && (creditStatus?.remaining ?? 1) <= 0 && (creditStatus?.used ?? 0) >= 1}
            onEditTrip={handleEditTrip}
            onViewMap={() => {
              setResultsView("map");
              window.setTimeout(() => recenterMap(), 200);
            }}
            onDaySelect={setActiveDayIndex}
            onAddRoadStop={addRoadStopToTrip}
            onRemoveRoadStop={removeRoadStopFromTrip}
            onAddFuelStop={addFuelStopToTrip}
            onLodgingSelect={addLodgingSelection}
            onDismissAlert={dismissTripAlert}
            onShare={handleShareItinerary}
            onCollaborate={handleOpenCollaborate}
            onToast={toast_}
            onStopSelect={handleResultsStopSelect}
            onGuestSignUp={() => openAuthModal("signup")}
            onDismissGuestBanner={() => setGuestBannerDismissed(true)}
            groceryAllowed={Boolean(creditStatus?.groceryDelivery)}
            accessToken={session?.access_token || null}
            onUpgradeGrocery={openGroceryUpgrade}
            isGuest={!user}
            onGrocerySignIn={() => openAuthModal("signin")}
          />
          </ErrorBoundary>
        ) : generated && resultsView === "map" ? (
          <div className="trip-map-fullscreen view-panel-animate">
            <div className="map-float-nav map-float-nav--edit-only">
              <button type="button" className="map-float-pill" onClick={handleEditTrip}>Edit plan</button>
            </div>
            <ErrorBoundary
              key={mapBoundaryKey}
              label="map-fullscreen"
              title="Could not load map"
              onRetry={() => setMapBoundaryKey(k => k + 1)}
            >
            <AppMap
              isLoaded={isLoaded}
              mapCenter={mapCenter}
              mapStyle={mapStyle}
              mapStyleOpen={mapStyleOpen}
              trafficAlert={trafficAlert}
              onDismissTrafficAlert={() => setTrafficAlert(false)}
              routeLoading={routeLoading}
              tripGenerating={loading}
              isDarkMode={theme === "night" || theme === "twilight"}
              theme={theme}
              mapRef={mapRef}
              directions={directionsResult}
              routeInfo={routeInfo}
              routePoints={routeInfo?.routePoints || []}
              answers={answers}
              mapMarkers={mapMarkers}
              dismissedAlertIds={dismissedAlerts}
              dayRoutePaths={[]}
              activeDayIndex={activeDayIndex}
              nightSegmentPaths={nightSegmentPaths}
              lowFuelSegmentPaths={lowFuelSegmentPaths}
              mapFocusTarget={mapFocusTarget}
              onMapReady={() => { setMapReady(true); window.setTimeout(() => recenterMap(), 200); }}
              onMapUnmount={() => setMapReady(false)}
              onMapStyleOpenChange={setMapStyleOpen}
              onMapStyleChange={setMapStyle}
              onRecenter={recenterMap}
              onBackToResults={() => setResultsView("itinerary")}
              onMarkerSelect={handleMapMarkerSelect}
              onMapBackgroundClick={handleMapBackgroundClick}
              onNavigateHome={handleNavigateHome}
              navigateHomePending={navigateHomePending}
              truckRoutePath={truckRoutePath}
              highlightedLegPath={itinerarySync.highlightedLegPath}
              inAppNavigationOnly
              routeFocusMode={itinerarySync.routeFocusMode}
              showNavigationCar
              onMarkerAction={(action, marker) => {
                if (action === "add") {
                  addRoadStopToTrip({
                    id: marker.id,
                    name: marker.title,
                    location: marker.subtitle,
                    lat: marker.lat,
                    lng: marker.lng,
                    category: marker.category || "poi",
                  });
                  toast_("Added to trip");
                } else if (action === "navigate") {
                  handleResultsStopSelect({
                    id: marker.waypointId || marker.id,
                    lat: marker.lat,
                    lng: marker.lng,
                    title: marker.title,
                  });
                } else {
                  focusMapOnStop(marker);
                }
              }}
            />
            </ErrorBoundary>
          </div>
        ) : (
        <div className="app">
          <ErrorBoundary
            key={mapBoundaryKey}
            label="map"
            title="Could not load map"
            onRetry={() => setMapBoundaryKey(k => k + 1)}
          >
          <AppMap
            isLoaded={isLoaded}
            mapCenter={mapCenter}
            mapStyle={mapStyle}
            mapStyleOpen={mapStyleOpen}
            trafficAlert={trafficAlert}
            onDismissTrafficAlert={() => setTrafficAlert(false)}
            routeLoading={routeLoading}
            tripGenerating={loading}
            isDarkMode={theme === "night" || theme === "twilight"}
            theme={theme}
            mapRef={mapRef}
            directions={directionsResult}
            routeInfo={routeInfo}
            routePoints={routeInfo?.routePoints || []}
            answers={answers}
            mapMarkers={mapMarkers}
            dismissedAlertIds={dismissedAlerts}
            dayRoutePaths={dayRoutePaths}
            activeDayIndex={generated ? activeDayIndex : null}
            nightSegmentPaths={nightSegmentPaths}
            lowFuelSegmentPaths={lowFuelSegmentPaths}
            mapFocusTarget={mapFocusTarget}
            onMapReady={() => setMapReady(true)}
            onMapUnmount={() => setMapReady(false)}
            onMapStyleOpenChange={setMapStyleOpen}
            onMapStyleChange={setMapStyle}
            onRecenter={recenterMap}
            onMarkerSelect={handleMapMarkerSelect}
            onMapBackgroundClick={handleMapBackgroundClick}
            truckRoutePath={truckRoutePath}
            showRoutePill={false}
            onMarkerAction={(action, marker) => {
              if (action === "add") {
                addRoadStopToTrip({
                  id: marker.id,
                  name: marker.title,
                  location: marker.subtitle,
                  lat: marker.lat,
                  lng: marker.lng,
                  category: marker.category || "poi",
                });
                toast_("Added to trip");
              }
            }}
          />
          </ErrorBoundary>

          <div
            className={`float-card ${theme} ${cardCollapsed ? "collapsed" : ""}${helpMenuOpen ? " help-open" : ""}${inQuestionFlow ? " float-card--plan-flow" : ""}${inQuestionFlow && cardCollapsed ? " float-card--plan-flow-collapsed" : ""}`}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            <div
              className={`float-card-header${inQuestionFlow ? " float-card-header--plan-flow" : ""}`}
              role={inQuestionFlow ? undefined : "button"}
              tabIndex={inQuestionFlow ? undefined : 0}
              aria-expanded={!cardCollapsed}
              onClick={inQuestionFlow ? undefined : handlePanelHeaderClick}
              onKeyDown={inQuestionFlow ? undefined : handlePanelHeaderKeyDown}
              onTouchStart={inQuestionFlow ? undefined : handlePanelTouchStart}
              onTouchMove={inQuestionFlow ? undefined : handlePanelTouchMove}
              onTouchEnd={inQuestionFlow ? undefined : handlePanelTouchEnd}
            >
              {!inQuestionFlow && <div className="float-card-handle" aria-hidden="true"/>}
              {inQuestionFlow ? (
                <PlanFlowHeaderBar
                  flowProgress={flowProgress}
                  creditsLabel={formatCreditsLabel(creditStatus)}
                  collapsed={cardCollapsed}
                  frozen={!!stepAnim}
                  helpButton={planPanelHelpButton}
                  onResetPlan={requestResetPlan}
                  onExpand={() => setCardCollapsed(false)}
                  onCollapse={() => setCardCollapsed(true)}
                />
              ) : (
                <>
                  <div className="float-card-header-row">
                    <div className="float-card-title">
                      {tab === "plan" ? "Plan Your Trip" : tab === "trips" ? "Trips" : "Live Sharing"}
                    </div>
                    <div className="float-card-header-actions" onClick={e => e.stopPropagation()}>
                      {planPanelHelpButton}
                      <button
                        type="button"
                        className={`float-card-chevron-btn${cardCollapsed ? "" : " open"}`}
                        onClick={e => { e.stopPropagation(); handlePanelHeaderClick(); }}
                        aria-label={cardCollapsed ? "Expand plan panel" : "Collapse plan panel"}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className={`float-card-body${inQuestionFlow ? " float-card-body--plan-flow" : ""}`}>
              <div className="float-card-scroll" ref={floatCardScrollRef}>
                <div className="sidebar-inner" style={{ background: "transparent" }}>
                  {tab === "plan" && (
                    <ErrorBoundary
                      key={planBoundaryKey}
                      label="plan-panel"
                      title="Could not show planner"
                      onRetry={() => setPlanBoundaryKey(k => k + 1)}
                    >
                    <PlanPanel
                      qIndex={qIndex}
                      currentQuestion={currentQuestion}
                      convoComplete={convoComplete}
                      loading={loading}
                      answers={displayAnswers}
                      committedAnswers={answers}
                      origin={origin}
                      dest={dest}
                      routeInfo={routeInfo}
                      tripLegs={tripLegs}
                      stepAnim={stepAnim}
                      enterAnim={enterAnim}
                      prefDraft={prefDraft}
                      questionHistory={questionHistory}
                      questionHistoryLength={questionHistory.length}
                      roadStops={roadStops}
                      selectedLodging={selectedLodging}
                      restaurantsByCity={restaurantsByCity}
                      convoEndRef={convoEndRef}
                      convoScrollRef={convoScrollRef}
                      creditsLabel={formatCreditsLabel(creditStatus)}
                      creditsNudge={creditsNudge}
                      creditsExhausted={creditsExhausted}
                      showGuestSaveHint={!user && !!answers.vehicle && !convoComplete}
                      showGuestSignInGate={showGuestSignInGate}
                      onGuestSignUp={() => openAuthModal("signup")}
                      onGuestSignIn={() => openAuthModal("signin")}
                      onUpgrade={openTripsUpgrade}
                      flowProgress={flowProgress}
                      returnedFromResults={returnedFromResults}
                      inQuestionFlow={inQuestionFlow}
                      toolbarInHeader={inQuestionFlow}
                      routeError={routeError}
                      onRetryRoute={retryRouteCalculation}
                      planOutOfDate={planOutOfDate}
                      planChanges={planChanges}
                      generationError={generationError}
                      onGenerateTrip={generateTrip}
                      onCancelGenerate={cancelGenerateTrip}
                      onResetPlan={requestResetPlan}
                      onGoBack={goBackOneQuestion}
                      onPickAnswer={pickAnswer}
                      onSetPrefDraft={setPrefDraft}
                      onSkipRoutePending={handleSkipRoutePending}
                      onRoutePendingTimeout={handleRoutePendingTimeout}
                      continuousDriveConfirm={continuousDriveConfirm}
                      onConfirmContinuousDrive={confirmContinuousDrive}
                      onCancelContinuousDrive={cancelContinuousDrive}
                      onEditQuestion={jumpToQuestion}
                      getStepMessage={getStepMessage}
                    />
                    </ErrorBoundary>
                  )}
                  {tab === "trips" && (
                    <TripsPanel
                      savedTrips={savedTrips}
                      onViewTrip={handleViewTrip}
                      onDeleteTrip={requestDeleteSavedTrip}
                      onPlanTrip={() => { setTab("plan"); setCardCollapsed(false); }}
                    />
                  )}
                  {tab === "share" && (
                    <LazySharePanel
                      user={user}
                      profile={userProfile}
                      session={session}
                      hasTrip={generated && (stops.length > 0 || roadStops.length > 0 || origin?.trim())}
                      origin={origin}
                      dest={dest}
                      stops={stops}
                      routeInfo={routeInfo}
                      isLoaded={isLoaded}
                      theme={theme}
                      toast={toast_}
                      onLiveSharingChange={setLiveSharingActive}
                      onShareTrip={handleShareItinerary}
                      onOpenCollaborate={handleOpenCollaborate}
                      hasCollaboration={Boolean(activeCollaboration)}
                      tripId={activeTripId}
                    />
                  )}
                </div>
              </div>
              {showPlanPanelDock && (
                <PlanPanelDock
                  isLoaded={isLoaded}
                  answers={answers}
                  origin={origin}
                  dest={dest}
                  timingMode={timingMode}
                  arriveByDate={arriveByDate}
                  originRef={originRef}
                  destRef={destRef}
                  onSwap={swapRouteCities}
                  onFetchDirections={fetchDirections}
                  onSetOrigin={setOrigin}
                  onSetDest={setDest}
                  onSetTimingMode={setTimingMode}
                  onSetArriveByDate={setArriveByDate}
                />
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {modal?.type === "report" && (
        <LazyReportIssueModal
          reportText={reportText}
          onTextChange={setReportText}
          onClose={() => { setModal(null); setReportText(""); }}
          onSubmit={async () => {
            toast_("Thanks — we'll review your report", true);
            setModal(null);
            setReportText("");
          }}
        />
      )}
      {authModal === "signup" && (
        <LazyEmailModal
          email={heroEmail}
          onEmailChange={setHeroEmail}
          onClose={() => setAuthModal(null)}
          onSignUp={handleEmailSignUp}
          onSwitchToSignIn={() => openAuthModal("signin")}
          onContinueWithPhone={() => { setAuthModal(null); openLazyPhoneModal(); }}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
          theme={theme}
        />
      )}
      {authModal === "phone" && (
        <LazyPhoneModal
          onClose={() => { setAuthModal(null); setAuthPhone(""); setAuthError(""); }}
          onSendCode={handlePhoneSendCode}
          onVerifyCode={handlePhoneVerify}
          onResendCode={handlePhoneResend}
          initialPhone={authPhone}
          loading={authBusy}
          error={authError}
          theme={theme}
        />
      )}
      {authModal === "signin" && (
        <LazySignInModal
          onClose={() => setAuthModal(null)}
          onSignIn={handleSignInSubmit}
          onForgotPassword={handleForgotPassword}
          onSwitchToSignup={() => openAuthModal("signup")}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
          theme={theme}
        />
      )}
      {!isAuthConfigured && authModal?.startsWith("oauth-") && (
        <LazyOAuthComingSoonModal
          provider={authModal.replace("oauth-", "")}
          onClose={() => setAuthModal(null)}
          onUseEmail={() => openAuthModal("signup")}
          theme={theme}
        />
      )}
      {showCollabPanel && (
        <CollaborationPanel
          open={showCollabPanel}
          onClose={() => setShowCollabPanel(false)}
          collaboration={activeCollaboration}
          onCollaborationChange={setActiveCollaboration}
          accessToken={session?.access_token || null}
          user={user}
          tripSnapshot={tripCollabSnapshot}
          activeTripId={activeTripId}
          onRegenerateWithGroup={handleRegenerateWithGroup}
          onToast={toast_}
        />
      )}

      {showUpgradeModal && (
        <LazyUpgradeModal
          creditStatus={creditStatus || getGuestCreditStatus()}
          user={user}
          accessToken={session?.access_token}
          onClose={() => setShowUpgradeModal(false)}
          onOpenPricing={openPricingPage}
          onSignUp={() => { setShowUpgradeModal(false); openAuthModal("signup"); }}
          reason={upgradeModalReason}
          resetDate={upgradeModalResetDate}
          initialPlan={upgradeModalInitialPlan ?? TIERS.TRAILBLAZER}
          initialBillingInterval={upgradeModalBillingInterval}
          onCheckoutError={msg => toast_(msg, { isError: true })}
        />
      )}
      {showHomeAddressModal && (
        <LazyHomeAddressModal
          isLoaded={isLoaded}
          initialAddress={homeAddress || getGuestHomeAddress()}
          onSave={handleSaveHomeAddress}
          onClose={() => { setShowHomeAddressModal(false); setNavigateHomePending(false); }}
        />
      )}
      <ConfirmDialog
        open={confirmResetOpen}
        title="Start over?"
        message="This clears your answers, generated trip, and saved draft for this plan. This cannot be undone."
        confirmLabel="Start over"
        cancelLabel="Keep planning"
        danger
        onConfirm={resetPlan}
        onCancel={() => setConfirmResetOpen(false)}
      />
      <ConfirmDialog
        open={Boolean(confirmDeleteTripId)}
        title="Delete saved trip?"
        message="This trip will be removed from your saved list."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          if (confirmDeleteTripId) deleteSavedTrip(confirmDeleteTripId);
          setConfirmDeleteTripId(null);
        }}
        onCancel={() => setConfirmDeleteTripId(null)}
      />
      <Toast
        message={toast}
        isGold={toastIsGold}
        isError={toastIsError}
        actionLabel={toastAction?.label}
        onAction={toastAction?.onClick}
      />
    </>
  );
}
