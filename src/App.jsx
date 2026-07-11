/**
 * TripMappa root orchestrator (~710 lines).
 * State, effects, handlers, and layout only — logic lives in src/lib/, UI in src/components/.
 * See ROADMAP.md for phase status and conventions.
 */
import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import {
  isTruckVehicle,
  isRvVehicle,
  hasPref,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
} from "./lib/vehicles.js";
import { buildTruckLodgingQuestion, getNextFlowQuestion, getFlowCompleteMessage, normalizeTripAnswers, getFlowProgress, isRouteContextReady, pruneStaleBranchAnswers, pruneRouteDependentAnswers, warnContinuousDriveFeasibility } from "./lib/tripFlow.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./lib/parsing.js";
import { OVERNIGHT_PREFERENCE_CONTINUOUS } from "./lib/driveMode.js";
import { preloadGenerationStreamOverlay, shouldPreloadGenerationLoader } from "./lib/preloadGenerationLoader.js";
import { stripSessionOnlyAnswers } from "./lib/tripHandlers.js";
import { configurePlacesAutocomplete, resolvePlaceFromAutocomplete } from "./lib/places.js";
import { getItineraryOverview, isIncludedRoadStop } from "./lib/itineraryDays.js";
import { isTowingSelected, getTripBudgetCap, getFuelRangeMiles } from "./lib/tripAccommodations.js";
import { computeBudgetEstimate } from "./lib/budget.js";
import { stopsToMapMarkers } from "./lib/mapMarkers.js";
import { useItinerarySync } from "./hooks/useItinerarySync.js";
import { computeDayRoutePaths } from "./lib/itineraryMap.js";
import { consolidateAndCapAlerts } from "./lib/tripAlerts.js";
import { buildPlanSnapshot, isPlanOutOfDate } from "./lib/planSnapshot.js";
import { describePlanChanges } from "./lib/planSnapshotDiff.js";
import CollaborationPanel from "./components/CollaborationPanel.jsx";
import { createAnswerChangeTracker, recordAnswerChange } from "./lib/answerIntent.js";
import {
  fetchUserTripPreferences,
  recordUserStopPreferences,
  mergeDisplayAnswers,
  stripUnconfirmedPrefillFromAnswers,
} from "./lib/generationContext.js";
import { formatCreditsDisplay } from "./lib/creditsDisplay.js";
import { resolveHeroOriginCoords } from "./lib/heroExplore.js";
import { roadStopKey, normalizeRoadStopEntry } from "./lib/roadStopKeys.js";
import { useLiveTripTips } from "./hooks/useLiveTripTips.js";
import { usePlanDraft, loadPlanDraft, clearPlanDraft } from "./hooks/usePlanDraft.js";
import { useShare } from "./hooks/useShare.js";
import { useAppAuth, SIGNUP_GENERATE_LEAD } from "./hooks/useAppAuth.jsx";
import { useMapState } from "./hooks/useMapState.js";
import { useGeneration } from "./hooks/useGeneration.js";
import { deleteTrip, saveTrip } from "./lib/tripsApi.js";
import { SAVED_TRIPS_KEY, writeLocalStorage } from "./lib/storageKeys.js";
import { TIERS } from "./lib/tiers.js";
import { createPortalSession } from "./lib/stripeApi.js";
import {
  LazyFounderWelcomeOverlay,
  LazyGenerationStreamOverlay,
  LazyHomeAddressModal,
  LazyReportIssueModal,
  LazyUpgradeModal,
  LazyUserPreferencesPage,
} from "./components/LazyModals.jsx";
const LazyHeroExploreMap = lazy(() => import("./components/HeroExploreMap.jsx"));
import { useTheme } from "./context/ThemeContext.jsx";
import { saveHomeAddress, saveDisplayName, saveNotificationPrefs, saveEmergencyContact, uploadAvatar, getGuestHomeAddress, setGuestHomeAddress } from "./lib/profileApi.js";

import PlanFlowHeaderBar from "./components/PlanFlowHeaderBar.jsx";
import PlanPanelHelpButton from "./components/PlanPanelHelpButton.jsx";
import HeroView from "./components/HeroView.jsx";
import NavigateRoutePanel from "./components/navigate/NavigateRoutePanel.jsx";
import TravelerOnboarding from "./components/TravelerOnboarding.jsx";
import AppNavBar from "./components/AppNavBar.jsx";
import AppMap from "./components/AppMap.jsx";
import ProximityTripTipAlert from "./components/ProximityTripTipAlert.jsx";
import PlanPanel from "./components/PlanPanel.jsx";
import PlanPanelDock from "./components/PlanPanelDock.jsx";
import PlanFlowActionDock from "./components/PlanFlowActionDock.jsx";
import TripsPanel from "./components/TripsPanel.jsx";
import { LazyTripResultsPanel, LazyLiveViewPage, LazyProfilePage, LazySharePanel } from "./components/LazyPanels.jsx";
import { resolveAppRoute } from "./lib/appRouter.js";
import Toast from "./components/Toast.jsx";
import GoldSpinner from "./components/GoldSpinner.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import ConfigWarningBanner from "./components/ConfigWarningBanner.jsx";

function formatCreditsLabel(status) {
  return formatCreditsDisplay(status).label;
}

function buildHeroTripPreview(tripStops, tripRoadStops, tripAnswers) {
  const overview = getItineraryOverview({
    stops: tripStops,
    roadStops: tripRoadStops,
    answers: tripAnswers || {},
  });
  const stopCount = overview.stopCount ?? 0;
  if (!stopCount && !(tripStops?.length || tripRoadStops?.length)) return null;
  return {
    stopCount,
    dayCount: overview.straightThrough ? 1 : Math.max(1, overview.dayCount || 1),
  };
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

export default function App() {
  const [view, setView] = useState("hero"); // "hero" | "app" | "profile"
  const [appMode, setAppMode] = useState("plan"); // "plan" | "navigate"
  const [tab, setTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [heroOrigin, setHeroOrigin] = useState("");
  const [heroDest, setHeroDest] = useState("");
  const [heroOriginError, setHeroOriginError] = useState("");
  const [heroDestError, setHeroDestError] = useState("");
  const [heroLaunching, setHeroLaunching] = useState(false);
  const [timingMode, setTimingMode] = useState("leave_now");
  const [arriveByDate, setArriveByDate] = useState("");
  const [prefDraft, setPrefDraft] = useState(null);
  const [flowDockActions, setFlowDockActions] = useState(null);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [answers, setAnswers] = useState({});
  const [flowPrefill, setFlowPrefill] = useState({});
  const [continuousDriveConfirm, setContinuousDriveConfirm] = useState(null);
  const [qIndex, setQIndex] = useState(-1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [lastTripPreview, setLastTripPreview] = useState(null);
  const [resultsView, setResultsView] = useState("planning"); // planning | itinerary | map
  const [stops, setStops] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [personalTouches, setPersonalTouches] = useState([]);
  const [changesMade, setChangesMade] = useState([]);
  const [planDraft, setPlanDraft] = useState(() => loadPlanDraft());
  const [roadStops, setRoadStops] = useState([]);
  const [tripFormat, setTripFormat] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedLodging, setSelectedLodging] = useState([]);
  const [tripAlerts, setTripAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [customStops, setCustomStops] = useState([]);
  const [activitiesByCity, setActivitiesByCity] = useState({});
  const [restaurantsByCity, setRestaurantsByCity] = useState({});
  const [weatherByCity, setWeatherByCity] = useState({});
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [optionalStopCards, setOptionalStopCards] = useState([]);
  const [tripLegs, setTripLegs] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalReason, setUpgradeModalReason] = useState("trips");
  const [upgradeModalResetDate, setUpgradeModalResetDate] = useState(null);
  const [upgradeModalInitialPlan, setUpgradeModalInitialPlan] = useState(null);
  const [upgradeModalBillingInterval, setUpgradeModalBillingInterval] = useState("month");
  const [homeAddress, setHomeAddress] = useState("");
  const [showHomeAddressModal, setShowHomeAddressModal] = useState(false);
  const [navigateHomePending, setNavigateHomePending] = useState(false);
  const [returnedFromResults, setReturnedFromResults] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmDeleteTripId, setConfirmDeleteTripId] = useState(null);
  const [resultsBoundaryKey, setResultsBoundaryKey] = useState(0);
  const [planBoundaryKey, setPlanBoundaryKey] = useState(0);
  const [mapBoundaryKey, setMapBoundaryKey] = useState(0);
  const [savedPlanSnapshot, setSavedPlanSnapshot] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const AppRoutePage = useMemo(() => resolveAppRoute(), []);
  const [profileScrollTo, setProfileScrollTo] = useState(null);
  const { theme } = useTheme();
  const toastFnRef = useRef(null);

  const {
    user,
    session,
    updateEmail,
    updatePassword,
    isAuthConfigured,
    authLoading,
    heroEmail,
    setHeroEmail,
    authModal,
    setAuthModal,
    authModalLead,
    setAuthModalLead,
    savedTrips,
    savedTripsRef,
    applySavedTrips,
    prependSavedTrip,
    planGenerationCount,
    creditStatus,
    creditStatusRef,
    applyCreditStatus,
    setCreditsNeedRefresh,
    refreshCredits,
    userProfile,
    setUserProfile,
    userProfileLoaded,
    founderWelcomeName,
    setFounderWelcomeName,
    planPreferencesRef,
    applyPlanPreferencesSaved,
    openAuthModal,
    closeAuthModal,
    renderAuthModals,
    handleSignOut,
    buildFlowPrefillForUser,
    handleTravelerOnboardingComplete,
  } = useAppAuth({
    toastFnRef,
    theme,
    view,
    setView,
    setHomeAddress,
    setShowUpgradeModal,
    setUpgradeModalReason,
    setFlowPrefill,
    setActiveTripId,
    convoComplete,
    generated,
    questionHistory,
  });

  const itinerarySyncRef = useRef(null);

  const {
    isLoaded,
    exploreRangeEnabled,
    setExploreRangeEnabled,
    exploreRangeDriveSeconds,
    setExploreRangeDriveSeconds,
    exploreRangePolygon,
    setExploreRangePolygon,
    exploreRangeLoading,
    setExploreRangeLoading,
    exploreRangeError,
    setExploreRangeError,
    exploreOriginCoords,
    setExploreOriginCoords,
    exploreSearchQuery,
    setExploreSearchQuery,
    exploreRangeAbortRef,
    mapStyle,
    setMapStyle,
    mapStyleOpen,
    setMapStyleOpen,
    trafficAlert,
    setTrafficAlert,
    mapMarkers,
    setMapMarkers,
    nightSegmentPaths,
    setNightSegmentPaths,
    lowFuelSegmentPaths,
    setLowFuelSegmentPaths,
    activeDayIndex,
    setActiveDayIndex,
    mapFocusTarget,
    setMapFocusTarget,
    highlightedStopId,
    setHighlightedStopId,
    routeError,
    setRouteError,
    highlightTimerRef,
    routeInfo,
    setRouteInfo,
    routePath,
    setRoutePath,
    truckRoutePath,
    setTruckRoutePath,
    directionsResult,
    setDirectionsResult,
    routeLoading,
    setRouteLoading,
    mapCenter,
    originRef,
    destRef,
    heroOriginRef,
    heroDestRef,
    heroOriginAcRef,
    heroDestAcRef,
    navigateOriginRef,
    navigateDestRef,
    mapRef,
    polylineRef,
    polylinesRef,
    polylineAnimRef,
    mapReady,
    setMapReady,
    fetchDirections,
    fetchRouteBetween,
    highlightStop,
    handleMapMarkerSelect,
    recenterMap,
    clearExploreRange,
    loadExploreRangeIsoline,
    handleExploreRangeToggle,
    handleExploreRangeDriveTimeChange,
    applyExploreRangeDestination,
    handleExploreRangeMapClick,
    handleExploreRangePlaceSelect,
    handleExploreRangeSearch,
    focusMapOnStop,
    getDepartureTime,
    flushMapLayout,
    flushPendingFitBounds,
  } = useMapState({
    answers,
    origin,
    dest,
    setOrigin,
    setDest,
    timingMode,
    arriveByDate,
    theme,
    toastFnRef,
    view,
    tab,
    generated,
    tripLegs,
    itinerarySyncRef,
  });

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
      writeLocalStorage(SAVED_TRIPS_KEY, JSON.stringify(updated));
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
  const panelDragStartY = useRef(null);
  const panelDragMoved = useRef(false);
  const [modal, setModal] = useState(null);
  const [enterAnim, setEnterAnim] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const [stepAnim, setStepAnim] = useState(null); // { answer, phase: 'selected' | 'exit' }
  const stepAnimTimer = useRef(null);
  const helpWrapRef = useRef(null);

  const answerChangeCountsRef = useRef(null);
  if (!answerChangeCountsRef.current) {
    answerChangeCountsRef.current = createAnswerChangeTracker();
  }
  const reAnswerFromEditRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const questionHistoryRef = useRef(questionHistory);
  questionHistoryRef.current = questionHistory;

  const buildQuestionContext = useCallback((newAnswers) => ({
    origin: origin?.trim() || routeInfo?.origin || "",
    destination: dest?.trim() || routeInfo?.destination || "",
    vehicle: newAnswers?.vehicle || routeInfo?.vehicleType || "Car",
    routeDistance: routeInfo?.distance,
    routeDuration: routeInfo?.duration,
    routeDistanceMiles: parseMilesFromDistance(routeInfo?.distance),
    routeDurationHours: parseHoursFromDuration(routeInfo?.duration),
    routeFailed: Boolean(routeError),
    routeErrorMessage: routeError || null,
    questionHistory: questionHistoryRef.current,
  }), [origin, dest, routeInfo, routeError]);

  const generateTripRef = useRef(null);
  const openAuthModalRef = useRef(null);
  openAuthModalRef.current = openAuthModal;

  const {
    shareViewMode,
    setShareViewMode,
    liveSharingActive,
    setLiveSharingActive,
    liveShareToken,
    showCollabPanel,
    setShowCollabPanel,
    activeCollaboration,
    setActiveCollaboration,
    collaborationHintsRef,
    handleShareItinerary,
    handleOpenCollaborate,
    handleRegenerateWithGroup,
    tripCollabSnapshot,
  } = useShare({
    user,
    session,
    openAuthModal: (mode, opts) => openAuthModalRef.current?.(mode, opts),
    toastFnRef,
    generateTripRef,
    origin,
    dest,
    stops,
    roadStops,
    tripTips,
    answers,
    routeInfo,
    selectedLodging,
    personalTouches,
    changesMade,
    setView,
    setOrigin,
    setDest,
    setStops,
    setRoadStops,
    setTripTips,
    setPersonalTouches,
    setChangesMade,
    setAnswers,
    setSelectedLodging,
    setRouteInfo,
    setGenerated,
    setResultsView,
    setConvoComplete,
    setTab,
    setMapMarkers,
  });


  const creditsNudge = useMemo(
    () => formatCreditsDisplay(creditStatus).nudge,
    [creditStatus],
  );

  const flowProgress = useMemo(() => getFlowProgress(answers, buildQuestionContext(answers), {
    convoComplete,
    currentQuestionId: convoComplete ? "done" : (currentQuestion?.id || "vehicle"),
  }), [answers, buildQuestionContext, convoComplete, currentQuestion?.id]);

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
  }), [origin, dest, originRef, destRef, answers, routeInfo]);

  const planOutOfDate = useMemo(
    () => generated && isPlanOutOfDate(savedPlanSnapshot, currentPlanSnapshot),
    [generated, savedPlanSnapshot, currentPlanSnapshot],
  );

  const planChanges = useMemo(
    () => describePlanChanges(savedPlanSnapshot, currentPlanSnapshot),
    [savedPlanSnapshot, currentPlanSnapshot],
  );

  const routeScoutLine = useMemo(() => {
    if (!routeInfo) return null;
    const milesRaw = routeInfo.distanceMiles ?? routeInfo.distance;
    const miles = typeof milesRaw === "number"
      ? milesRaw
      : parseFloat(String(milesRaw || "").replace(/[^\d.]/g, ""));
    const cityCount = routeInfo.citiesAlongRoute?.length;
    const parts = [];
    if (Number.isFinite(miles) && miles > 0) parts.push(`${Math.round(miles)} mi mapped`);
    if (cityCount > 0) parts.push(`${cityCount} cities along your corridor`);
    return parts.length ? parts.join(" · ") : null;
  }, [routeInfo]);

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
  const showPlanPanelDock = tab === "plan" && !cardCollapsed && !inQuestionFlow;
  const showPlanFlowActionDock = tab === "plan" && !cardCollapsed && inQuestionFlow && !convoComplete;

  // Float-card width/height transitions run ~350ms; resize map after panel settles so tiles fill the viewport.
  useEffect(() => {
    if ((view !== "app" && !(view === "hero" && appMode === "navigate")) || !mapReady) return undefined;
    if (view === "app" && (tab !== "plan" || cardCollapsed)) return undefined;
    const timer = window.setTimeout(() => flushMapLayout(), 400);
    return () => window.clearTimeout(timer);
  }, [view, appMode, tab, inQuestionFlow, cardCollapsed, mapReady, flushMapLayout]);
  const creditsExhausted = useMemo(() => {
    if (!user || !creditStatus) return false;
    return !creditStatus.unlimited && (creditStatus.remaining ?? 0) <= 0;
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

  function handleAppModeChange(mode) {
    if (mode === appMode) return;
    setAppMode(mode);
    if (mode === "navigate" && view !== "hero") {
      setView("hero");
    }
  }

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
        appMode={appMode}
        onAppModeChange={handleAppModeChange}
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
    const profile = await uploadAvatar(file);
    setUserProfile(profile);
  }

  async function handleProfileSaveDisplayName(name) {
    const profile = await saveDisplayName(name);
    setUserProfile(profile);
  }

  async function handleProfileSaveNotifications(prefs) {
    const profile = await saveNotificationPrefs(prefs);
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
    setHighlightedStopId(null);
    setLoading(false);
    setAuthModalLead("");
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
        await saveHomeAddress(trimmed);
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
  }, [currentQuestion, stepAnim]);

  useEffect(() => {
    if (!currentQuestion?.id && !convoComplete) return;
    if (inQuestionFlow && !convoComplete) {
      scrollPlanToTop();
      return;
    }
    requestAnimationFrame(() => {
      convoEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [currentQuestion?.id, questionHistory.length, convoComplete, inQuestionFlow, scrollPlanToTop]);

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
  }, [trafficAlert, setTrafficAlert]);


  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
    setToastAction(null);
    setToastIsError(false);
  }

  function runToastAction() {
    const action = toastAction?.onClick;
    dismissToast();
    action?.();
  }

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
  itinerarySyncRef.current = itinerarySync;

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

  function swapNavigateRoute() {
    const fromVal = navigateOriginRef.current?.value ?? origin;
    const toVal = navigateDestRef.current?.value ?? dest;
    if (navigateOriginRef.current) navigateOriginRef.current.value = toVal;
    if (navigateDestRef.current) navigateDestRef.current.value = fromVal;
    setOrigin(toVal);
    setDest(fromVal);
  }

  async function handleNavigateGetRoute() {
    const fromVal = navigateOriginRef.current?.value?.trim() || origin.trim();
    const toVal = navigateDestRef.current?.value?.trim() || dest.trim();
    if (!fromVal || !toVal) {
      toast_("Enter a start and destination");
      return;
    }
    if (!isLoaded || !window.google) {
      toast_("Map is still loading — try again in a moment");
      return;
    }
    setOrigin(fromVal);
    setDest(toVal);
    const ok = await fetchRouteBetween(fromVal, toVal);
    if (ok) toast_("Route ready", true);
    else toast_("Could not calculate route — check addresses and try again", { isError: true });
  }

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

  const applyPrefDraftForQuestion = useCallback((question, newAnswers, prefillOverride) => {
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
        draft[sec.id] = fromAnswers.length ? [...fromAnswers] : (fromPrefill.length ? [...fromPrefill] : []);
      }
      if (question.type === "trip_details") {
        draft.trip_budget = newAnswers.trip_budget || prefillSource.trip_budget || "No budget limit";
      }
      setPrefDraft(draft);
    } else if (question.type === "multiselect") {
      const fromAnswers = Array.isArray(newAnswers[question.id]) ? newAnswers[question.id] : [];
      const fromPrefill = Array.isArray(prefillSource[question.id]) ? prefillSource[question.id] : [];
      setPrefDraft(fromAnswers.length ? [...fromAnswers] : (fromPrefill.length ? [...fromPrefill] : []));
    } else if (question.type === "party_composition") {
      setPrefDraft({
        adults: newAnswers.adult_count ?? prefillSource.adult_count ?? null,
        children: newAnswers.child_count ?? prefillSource.child_count ?? null,
      });
    } else {
      setPrefDraft(null);
    }
  }, [flowPrefill]);

  const {
    enrichingTrip,
    setEnrichingTrip,
    enrichingPlaces,
    enrichmentLimited,
    setEnrichmentLimited,
    enrichmentNoticeDismissed,
    setEnrichmentNoticeDismissed,
    generationStream,
    tripUsedFallback,
    setTripUsedFallback,
    generationError,
    setGenerationError,
    dismissedActionTipIds,
    setDismissedActionTipIds,
    generateTripInFlightRef,
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
  } = useGeneration({
    loading,
    setLoading,
    generated,
    setGenerated,
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
    setLastTripPreview,
    setResultsView,
    setTab,
    setCardCollapsed,
    setSavedPlanSnapshot,
    savedPlanSnapshot,
    currentPlanSnapshot,
    tripLegs,
    itinerarySync,
    collaborationHintsRef,
    generateTripRef,
    toastFnRef,
    buildHeroTripPreview,
  });


  const loadNextQuestion = useCallback((newAnswers, options = {}) => {
    if (generateTripInFlightRef.current) return;
    if (convoComplete && !generated) return;
    setStepAnim(null);
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
  }, [
    generateTripInFlightRef,
    convoComplete,
    generated,
    buildQuestionContext,
    applyPrefDraftForQuestion,
  ]);

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
    const patch = { ...answersRef.current, route_context_unavailable: true };
    const ctx = buildQuestionContext(patch);
    const na = normalizeTripAnswers(patch, ctx);
    setAnswers(na);
    loadNextQuestion(na);
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
  }, [
    routeInfo?.distance,
    routeInfo?.duration,
    routeError,
    currentQuestion?.pendingRoute,
    currentQuestion?.id,
    convoComplete,
    buildQuestionContext,
    generateTripInFlightRef,
    loadNextQuestion,
  ]);

  useEffect(() => {
    if (convoComplete || generated || !origin?.trim() || !dest?.trim()) return;
    if (answers.vehicle && routeInfo?.distance) return;
    fetchDirections(answers.vehicle || "Car");
  }, [origin, dest, answers.vehicle, generated, convoComplete, fetchDirections, routeInfo?.distance]);

  useEffect(() => {
    if (view !== "app" || generated || convoComplete || qIndex !== -1) return;
    if (!origin?.trim() || !dest?.trim()) return;
    loadNextQuestion({});
  }, [view, origin, dest, generated, convoComplete, qIndex, loadNextQuestion]);

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
        setQuestionHistory(h => {
          const entry = { question: historyQuestion, answer: value };
          const idx = h.findIndex(e => e.question?.id === activeQuestion.id);
          if (idx >= 0) {
            const next = [...h];
            next[idx] = entry;
            return next;
          }
          return [...h, entry];
        });
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

  const departureTime = useMemo(() => getDepartureTime(), [getDepartureTime]);

  const dayRoutePaths = useMemo(() => {
    if (!generated || !routeInfo?.routePoints?.length) return [];
    const overnightCount = Math.max(1, stops.filter(s => s.city).length);
    return computeDayRoutePaths(routeInfo.routePoints, overnightCount);
  }, [generated, routeInfo, stops]);


  function handleResultsStopSelect(stop) {
    if (!stop) return;
    const id = stop.id || stop.placeId || `focus-${stop.lat}-${stop.lng}`;
    highlightStop(id);
    if (generated && itinerarySync.itineraryWaypoints.length) {
      itinerarySync.handleNavigateToStop({ ...stop, id });
      if (resultsView === "itinerary") {
        setResultsView("map");
      }
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

  function isRoadStopOnRoute(stop) {
    const id = stop?.id || stop?.stopData?.id;
    if (generated && itinerarySync.itineraryWaypoints.length && id) {
      return itinerarySync.isWaypointIncluded(id);
    }
    return isIncludedRoadStop(stop?.stopData || stop);
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
      itinerarySync.handleRemoveStop(id);
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


  function requestResetPlan() {
    setConfirmResetOpen(true);
  }

  function resetPlan() {
    setConfirmResetOpen(false);
    setTripUsedFallback(false);
    setGenerationError(null);
    setSavedPlanSnapshot(null);
    setReturnedFromResults(false);
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

  function jumpToAssumedTruckLodging() {
    if (stepAnim) return;
    reAnswerFromEditRef.current = true;
    setAnswers(prev => {
      const next = { ...prev };
      delete next.lodging;
      delete next.lodging_auto_assigned;
      return next;
    });
    setConvoComplete(false);
    setCurrentQuestion(buildTruckLodgingQuestion());
    setQIndex(0);
    setPrefDraft(null);
    scrollPlanToTop();
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
    const heroPreview = buildHeroTripPreview(trip.stops || [], trip.roadStops || [], tripAnswers);
    if (heroPreview) setLastTripPreview(heroPreview);
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
          onAction={toastAction ? runToastAction : undefined}
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
              const profile = await saveHomeAddress(addr);
              setUserProfile(profile);
              setHomeAddress(addr);
            }}
            onSaveEmergencyContact={async (phone) => {
              const profile = await saveEmergencyContact(phone);
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
          onAction={toastAction ? runToastAction : undefined}
        />
      </>
    );
  }

  if (user && !userProfileLoaded) {
    return (
      <div className={`app-wrap ${theme}`}>
        {renderAppNavBar("app")}
        <div className="profile-loading-shell" role="status" aria-busy="true" aria-label="Loading your profile">
          <GoldSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (user && userProfileLoaded && userProfile?.onboarding_complete !== true) {
    return (
      <TravelerOnboarding onComplete={handleTravelerOnboardingComplete} />
    );
  }

  if (view === "hero" && appMode === "navigate") {
    return (
      <>
        <div className={`app-wrap ${theme} navigate-map-wrap`}>
          {renderAppNavBar("hero")}
          <NavigateRoutePanel
            isLoaded={isLoaded}
            origin={origin}
            dest={dest}
            originRef={navigateOriginRef}
            destRef={navigateDestRef}
            onOriginChange={setOrigin}
            onDestChange={setDest}
            onSwap={swapNavigateRoute}
            onGetRoute={handleNavigateGetRoute}
            routeLoading={routeLoading}
            theme={theme}
          />
          <div className="trip-map-fullscreen navigate-map-fullscreen view-panel-animate">
            <ErrorBoundary
              key={mapBoundaryKey}
              label="navigate-map"
              title="Could not load map"
              onRetry={() => setMapBoundaryKey(k => k + 1)}
            >
              <AppMap
                display={{
                  isLoaded,
                  isDarkMode: theme === "night" || theme === "twilight",
                  showNavigationCar: true,
                }}
                mapCenter={mapCenter}
                mapStyle={mapStyle}
                mapStyleOpen={mapStyleOpen}
                trafficAlert={trafficAlert}
                onDismissTrafficAlert={() => setTrafficAlert(false)}
                routeLoading={routeLoading}
                tripGenerating={loading}
                theme={theme}
                mapRef={mapRef}
                directions={directionsResult}
                routeInfo={routeInfo}
                routePoints={routeInfo?.routePoints || []}
                answers={answers}
                mapMarkers={mapMarkers}
                dismissedAlertIds={dismissedAlerts}
                dayRoutePaths={[]}
                activeDayIndex={null}
                nightSegmentPaths={nightSegmentPaths}
                lowFuelSegmentPaths={lowFuelSegmentPaths}
                mapFocusTarget={mapFocusTarget}
                onMapReady={() => { setMapReady(true); flushMapLayout(); }}
                onMapUnmount={() => setMapReady(false)}
                onFlushPendingFitBounds={flushPendingFitBounds}
                onMapStyleOpenChange={setMapStyleOpen}
                onMapStyleChange={setMapStyle}
                onRecenter={recenterMap}
                onMarkerSelect={handleMapMarkerSelect}
                onMarkerAction={(action, marker) => {
                  if (action === "directions" && marker?.lat != null && marker?.lng != null) {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`,
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }
                }}
                onMapBackgroundClick={handleMapBackgroundClick}
                onNavigateHome={handleNavigateHome}
                navigateHomePending={navigateHomePending}
                truckRoutePath={truckRoutePath}
                highlightedLegPath={[]}
                inAppNavigationOnly
              />
            </ErrorBoundary>
          </div>
        </div>
        {renderAuthModals()}
        {showHomeAddressModal && (
          <LazyHomeAddressModal
            isLoaded={isLoaded}
            initialAddress={homeAddress || getGuestHomeAddress() || ""}
            onSave={handleSaveHomeAddress}
            onClose={() => { setShowHomeAddressModal(false); setNavigateHomePending(false); }}
          />
        )}
        <Toast
          message={toast}
          isGold={toastIsGold}
          isError={toastIsError}
          actionLabel={toastAction?.label}
          onAction={toastAction ? runToastAction : undefined}
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
        onHeroOriginAcLoad={ac => { heroOriginAcRef.current = ac; configurePlacesAutocomplete(ac); }}
        onHeroDestAcLoad={ac => { heroDestAcRef.current = ac; configurePlacesAutocomplete(ac); }}
        onHeroOriginPlaceChanged={() => {
          if (heroOriginRef.current) setHeroOrigin(heroOriginRef.current.value);
          setHeroOriginError("");
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
        appMode={appMode}
        onAppModeChange={handleAppModeChange}
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
        lastTripPreview={lastTripPreview}
        heroTheme={theme}
      />
      {founderWelcomeName && (
        <LazyFounderWelcomeOverlay
          firstName={founderWelcomeName}
          onDismiss={() => setFounderWelcomeName(null)}
        />
      )}
      {renderAuthModals()}
      <Toast
        message={toast}
        isGold={toastIsGold}
        isError={toastIsError}
        actionLabel={toastAction?.label}
        onAction={toastAction ? runToastAction : undefined}
      />
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
        {!shareViewMode && renderAppNavBar("app")}
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
            personalTouches={personalTouches}
            changesMade={changesMade}
            enrichingTrip={enrichingTrip || enrichingPlaces}
            enrichmentLimited={enrichmentLimited && !enrichmentNoticeDismissed}
            planOutOfDate={planOutOfDate}
            planChanges={planChanges}
            onRegenerateTrip={generateTrip}
            generateLoading={loading}
            onCancelEnrichment={cancelEnrichment}
            onDismissEnrichmentNotice={() => setEnrichmentNoticeDismissed(true)}
            onRetryEnrichment={retryEnrichment}
            onEnrichPlacesOnMount={runPlacesEnrichment}
            tripUsedFallback={tripUsedFallback}
            isStopAdded={isRoadStopAdded}
            isStopOnRoute={isRoadStopOnRoute}
            shareMode={shareViewMode}
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
            onEditTrip={handleEditTrip}
            onViewMap={() => {
              itinerarySync.setRouteFocusMode(false);
              setResultsView("map");
              window.setTimeout(() => flushMapLayout(), 250);
            }}
            onStartNavigation={() => {
              if (itinerarySync.itineraryWaypoints.length) {
                itinerarySync.handleStartNavigation();
              } else {
                recenterMap();
              }
              setResultsView("map");
              window.setTimeout(() => flushMapLayout(), 250);
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
            groceryAllowed={Boolean(creditStatus?.groceryDelivery)}
            accessToken={session?.access_token || null}
            onUpgradeGrocery={openGroceryUpgrade}
            isGuest={!user}
            onGrocerySignIn={() => openAuthModal("signin")}
            waypoints={itinerarySync.itineraryWaypoints}
          />
          </ErrorBoundary>
        ) : generated && resultsView === "map" ? (
          <div className="trip-map-fullscreen view-panel-animate">
            <div className="map-float-nav map-float-nav--edit-only">
              <button type="button" className="map-float-pill" onClick={handleEditTrip}>Edit plan</button>
            </div>
            <ProximityTripTipAlert
              active={itinerarySync.routeFocusMode}
              tripTips={tripTips}
              liveTripTips={displayLiveTips}
              tripAlerts={tripAlerts.filter(a => !dismissedAlerts.includes(a.id))}
              weatherByCity={weatherByCity}
              routePoints={routeInfo?.routePoints || []}
              destination={dest}
            />
            <ErrorBoundary
              key={mapBoundaryKey}
              label="map-fullscreen"
              title="Could not load map"
              onRetry={() => setMapBoundaryKey(k => k + 1)}
            >
            <AppMap
              display={{
                isLoaded,
                isDarkMode: theme === "night" || theme === "twilight",
                showNavigationCar: true,
              }}
              mapCenter={mapCenter}
              mapStyle={mapStyle}
              mapStyleOpen={mapStyleOpen}
              trafficAlert={trafficAlert}
              onDismissTrafficAlert={() => setTrafficAlert(false)}
              routeLoading={routeLoading}
              tripGenerating={loading}
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
              onMapReady={() => { setMapReady(true); flushMapLayout(); }}
              onMapUnmount={() => setMapReady(false)}
              onFlushPendingFitBounds={flushPendingFitBounds}
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
                  toast_("Added to trip", {
                    actionLabel: "Undo",
                    onAction: () => removeRoadStopFromTrip({
                      id: marker.id,
                      name: marker.title,
                      location: marker.subtitle,
                      lat: marker.lat,
                      lng: marker.lng,
                      category: marker.category || "poi",
                    }),
                  });
                } else if (action === "navigate" || action === "directions") {
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
          {exploreRangeEnabled && exploreOriginCoords && exploreRangePolygon.length >= 3 && tab === "plan" && !generated && (
            <Suspense fallback={<div className="plan-explore-map" aria-hidden="true" />}>
              <div className="plan-explore-map">
                <LazyHeroExploreMap
                  isLoaded={isLoaded}
                  center={exploreOriginCoords}
                  polygon={exploreRangePolygon}
                  theme={theme}
                  onMapClick={handleExploreRangeMapClick}
                  onPlaceSelect={handleExploreRangePlaceSelect}
                />
              </div>
            </Suspense>
          )}
          <ErrorBoundary
            key={mapBoundaryKey}
            label="map"
            title="Could not load map"
            onRetry={() => setMapBoundaryKey(k => k + 1)}
          >
          <AppMap
            display={{
              isLoaded,
              isDarkMode: theme === "night" || theme === "twilight",
              showRoutePill: false,
            }}
            mapCenter={mapCenter}
            mapStyle={mapStyle}
            mapStyleOpen={mapStyleOpen}
            trafficAlert={trafficAlert}
            onDismissTrafficAlert={() => setTrafficAlert(false)}
            routeLoading={routeLoading}
            tripGenerating={loading}
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
            onMapReady={() => { setMapReady(true); flushMapLayout(); }}
            onMapUnmount={() => setMapReady(false)}
            onFlushPendingFitBounds={flushPendingFitBounds}
            onMapStyleOpenChange={setMapStyleOpen}
            onMapStyleChange={setMapStyle}
            onRecenter={recenterMap}
            onMarkerSelect={handleMapMarkerSelect}
            onMapBackgroundClick={handleMapBackgroundClick}
            truckRoutePath={truckRoutePath}
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
                toast_("Added to trip", {
                  actionLabel: "Undo",
                  onAction: () => removeRoadStopFromTrip({
                    id: marker.id,
                    name: marker.title,
                    location: marker.subtitle,
                    lat: marker.lat,
                    lng: marker.lng,
                    category: marker.category || "poi",
                  }),
                });
              } else if (action === "navigate" || action === "directions") {
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
            highlightedLegPath={generated ? itinerarySync.highlightedLegPath : []}
            routeFocusMode={generated ? itinerarySync.routeFocusMode : false}
            inAppNavigationOnly={generated}
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
                  onExpand={() => setCardCollapsed(false)}
                  onCollapse={() => setCardCollapsed(true)}
                  showProgress={false}
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
                      convoEndRef={convoEndRef}
                      convoScrollRef={convoScrollRef}
                      creditsLabel={formatCreditsLabel(creditStatus)}
                      creditsNudge={creditsNudge}
                      creditsExhausted={creditsExhausted}
                      showGuestSaveHint={!user && inQuestionFlow}
                      onGuestSignIn={() => openAuthModal("signin")}
                      onUpgrade={openTripsUpgrade}
                      flowProgress={flowProgress}
                      inQuestionFlow={inQuestionFlow}
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
                      onEditAssumedLodging={jumpToAssumedTruckLodging}
                      routeScoutLine={routeScoutLine}
                      onDockActionsChange={setFlowDockActions}
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
              {showPlanFlowActionDock && (
                <PlanFlowActionDock
                  actions={flowDockActions}
                  onStartOver={requestResetPlan}
                />
              )}
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
                  exploreRangeEnabled={exploreRangeEnabled}
                  exploreRangeDriveSeconds={exploreRangeDriveSeconds}
                  exploreRangeLoading={exploreRangeLoading}
                  exploreRangeError={exploreRangeError}
                  exploreSearchQuery={exploreSearchQuery}
                  onExploreSearchChange={setExploreSearchQuery}
                  onExploreSearchSubmit={handleExploreRangeSearch}
                  onExploreRangeToggle={handleExploreRangeToggle}
                  onExploreRangeDriveTimeChange={handleExploreRangeDriveTimeChange}
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
      {renderAuthModals()}
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
          creditStatus={creditStatus}
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
        onAction={toastAction ? runToastAction : undefined}
      />
    </>
  );
}

