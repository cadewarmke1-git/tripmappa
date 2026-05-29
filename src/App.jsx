/**
 * TripMappa root orchestrator (~710 lines).
 * State, effects, handlers, and layout only — logic lives in src/lib/, UI in src/components/.
 * See ROADMAP.md for phase status and conventions.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_LIBRARIES, LEG_MAP_STYLES, TRIP_ROUTE_GOLD } from "./lib/constants.js";
import { resolveMapStyles } from "./lib/mapStyles.js";
import {
  isTruckVehicle,
  isRvVehicle,
  hasPref,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
} from "./lib/vehicles.js";
import { getNextFlowQuestion, getFlowCompleteMessage, normalizeTripAnswers, getFlowProgress, isRouteContextReady } from "./lib/tripFlow.js";
import { computeHOSCompliance } from "./lib/hos.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./lib/parsing.js";
import { buildContinuousDriveTip, isContinuousDrive } from "./lib/driveMode.js";
import { TRUCK_SAFETY_FALLBACK, RV_SAFETY_FALLBACK } from "./lib/tripData.js";
import { generateTripPlan } from "./lib/apiClient.js";
import { buildFallbackTripData, parseTripApiResponse, stripSessionOnlyAnswers } from "./lib/tripHandlers.js";
import { resolvePlaceFromAutocomplete } from "./lib/places.js";
import { enrichGeneratedTrip } from "./lib/tripEnrichment.js";
import { createItineraryShareLink, loadSharedItinerary } from "./lib/itineraryShare.js";
import { buildPlacesContext, formatPlacesContextForPrompt } from "./lib/placesContext.js";
import { isTowingSelected, getTripBudgetCap, getFuelRangeMiles } from "./lib/tripAccommodations.js";
import { computeBudgetEstimate } from "./lib/budget.js";
import { stopsToMapMarkers } from "./lib/mapMarkers.js";
import { computeNightDrivingBlocks, computeLowFuelSegmentPath } from "./lib/tripMapSegments.js";
import { computeDayRoutePaths } from "./lib/itineraryMap.js";
import { consolidateAndCapAlerts } from "./lib/tripAlerts.js";
import { roadStopKey } from "./lib/roadStopKeys.js";
import { useLiveTripTips } from "./hooks/useLiveTripTips.js";
import { usePlanDraft, loadPlanDraft, clearPlanDraft } from "./hooks/usePlanDraft.js";
import { useAuth } from "./context/AuthContext.jsx";
import { deleteTrip, fetchTrips, migrateLocalTrips, saveTrip } from "./lib/tripsApi.js";
import { fetchTripCredits } from "./lib/tripCreditsApi.js";
import { getGuestCreditStatus, consumeGuestCredit } from "./lib/guestCredits.js";
import { fetchUserProfile, saveHomeAddress, saveDisplayName, saveNotificationPrefs, saveEmergencyContact, uploadAvatar, getGuestHomeAddress, setGuestHomeAddress } from "./lib/profileApi.js";

import HeroView from "./components/HeroView.jsx";
import AppMap from "./components/AppMap.jsx";
import PlanPanel from "./components/PlanPanel.jsx";
import PlanPanelDock from "./components/PlanPanelDock.jsx";
import TripsPanel from "./components/TripsPanel.jsx";
import { LazyTripResultsPanel, LazyLiveViewPage, LazyProfilePage, LazySharePanel } from "./components/LazyPanels.jsx";
import { parseLiveShareToken } from "./lib/liveShareApi.js";
import GroceryModal from "./components/GroceryModal.jsx";
import EmailModal from "./components/EmailModal.jsx";
import SignInModal from "./components/auth/SignInModal.jsx";
import PhoneModal from "./components/auth/PhoneModal.jsx";
import OAuthComingSoonModal from "./components/auth/OAuthComingSoonModal.jsx";
import UpgradeModal from "./components/UpgradeModal.jsx";
import HomeAddressModal from "./components/HomeAddressModal.jsx";
import { sendSmsOtp, verifySmsOtp } from "./lib/phoneAuthApi.js";
import ReportIssueModal from "./components/ReportIssueModal.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Toast from "./components/Toast.jsx";
import NavLogo from "./components/NavLogo.jsx";
import UserNavMenu from "./components/UserNavMenu.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

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
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSearchHover, setHeroSearchHover] = useState(false);
  const [authModal, setAuthModal] = useState(null); // signin | signup | phone | oauth-*
  const [authPhone, setAuthPhone] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [timingMode, setTimingMode] = useState("leave_now");
  const [arriveByDate, setArriveByDate] = useState("");
  const [prefDraft, setPrefDraft] = useState([]);
  const [hosCompliance, setHosCompliance] = useState(null);
  const [truckSafety, setTruckSafety] = useState(null);
  const [rvSafety, setRvSafety] = useState(null);
  const [mapStyle, setMapStyle] = useState("standard");
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [trafficAlert, setTrafficAlert] = useState(false);
  const [answers, setAnswers] = useState({});
  const [qIndex, setQIndex] = useState(-1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [resultsView, setResultsView] = useState("planning"); // planning | itinerary | map
  const [stops, setStops] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [addedRoadStopIds, setAddedRoadStopIds] = useState([]);
  const [enrichingTrip, setEnrichingTrip] = useState(false);
  const [enrichmentLimited, setEnrichmentLimited] = useState(false);
  const [enrichmentNoticeDismissed, setEnrichmentNoticeDismissed] = useState(false);
  const [planDraft] = useState(() => loadPlanDraft());
  const [roadStops, setRoadStops] = useState([]);
  const [tripFormat, setTripFormat] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedLodging, setSelectedLodging] = useState([]);
  const [tripAlerts, setTripAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [mapMarkers, setMapMarkers] = useState([]);
  const [customStops, setCustomStops] = useState([]);
  const [nearbyServicesByCity, setNearbyServicesByCity] = useState({});
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
  const [stopCategory, setStopCategory] = useState("all");
  const [savedTrips, setSavedTrips] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tripmappa-saved") || "[]"); } catch { return []; }
  });
  const [creditStatus, setCreditStatus] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [homeAddress, setHomeAddress] = useState("");
  const [showHomeAddressModal, setShowHomeAddressModal] = useState(false);
  const [navigateHomePending, setNavigateHomePending] = useState(false);
  const [returnedFromResults, setReturnedFromResults] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [highlightedStopId, setHighlightedStopId] = useState(null);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const [liveSharingActive, setLiveSharingActive] = useState(false);
  const liveShareToken = useMemo(() => parseLiveShareToken(), []);
  const highlightTimerRef = useRef(null);

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

  function openPhoneModal() {
    setAuthError("");
    setAuthPhone("");
    setAuthModal("phone");
  }

  async function handleSignOut() {
    intentionalSignOutRef.current = true;
    try {
      await signOut();
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
      answers: stripSessionOnlyAnswers(answers),
      routeInfo,
      selectedLodging,
    };
  }

  async function persistTripForUser(userId) {
    const tripPayload = buildTripSavePayload();
    const saved = await saveTrip(userId, tripPayload);
    setSavedTrips(prev => [saved, ...prev.filter(t => t.id !== saved.id)]);
    return saved;
  }

  async function saveCurrentTrip() {
    if (!user) {
      openAuthModal("signin");
      toast_("Sign in to save trips");
      return;
    }
    if (!origin?.trim() || !dest?.trim()) {
      toast_("Plan a trip first");
      return;
    }
    try {
      await persistTripForUser(user.id);
      toast_("Trip saved", true);
    } catch (err) {
      console.error("Save trip error:", err);
      toast_(err.message || "Could not save trip");
    }
  }

  async function deleteSavedTrip(id) {
    if (user) {
      try {
        await deleteTrip(user.id, id);
      } catch (err) {
        toast_(err.message || "Could not delete trip");
        return;
      }
    }
    const updated = savedTrips.filter(t => t.id !== id);
    setSavedTrips(updated);
    if (!user) {
      try { localStorage.setItem("tripmappa-saved", JSON.stringify(updated)); } catch {}
    }
    toast_("Trip removed");
  }
  const [toast, setToast] = useState(null);
  const [toastIsGold, setToastIsGold] = useState(false);
  const [toastAction, setToastAction] = useState(null);
  const toastTimerRef = useRef(null);
  const hadUserRef = useRef(false);
  const intentionalSignOutRef = useRef(false);
  const sessionExpiredNotifiedRef = useRef(false);
  const [guestTripPendingSave, setGuestTripPendingSave] = useState(false);
  const panelDragStartY = useRef(null);
  const panelDragMoved = useRef(false);
  const [modal, setModal] = useState(null);
  const [groceryInput, setGroceryInput] = useState("");
  const [groceryItems, setGroceryItems] = useState([]);
  const [autoTheme, setAutoTheme] = useState(computeAutoTheme);
  const [themeOverride, setThemeOverride] = useState(null);
  const theme = themeOverride ?? autoTheme;
  const [enterAnim, setEnterAnim] = useState(false);
  const [cardCollapsed, setCardCollapsed] = useState(false);
  const [stepAnim, setStepAnim] = useState(null); // { answer, phase: 'pop' | 'exit' }
  const stepAnimTimer = useRef(null);
  const helpWrapRef = useRef(null);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      try {
        setSavedTrips(JSON.parse(localStorage.getItem("tripmappa-saved") || "[]"));
      } catch {
        setSavedTrips([]);
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
        if (!cancelled) setSavedTrips(trips);
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
        .then(setCreditStatus)
        .catch(() => setCreditStatus({ tier: "free", unlimited: false, remaining: 3, limit: 3 }));
      fetchUserProfile(user.id)
        .then(profile => {
          if (profile?.home_address) setHomeAddress(profile.home_address);
          setUserProfile(profile);
        })
        .catch(() => {});
    } else {
      setCreditStatus(getGuestCreditStatus());
      setUserProfile(null);
      const guestHome = getGuestHomeAddress();
      if (guestHome) setHomeAddress(guestHome);
    }
  }, [user?.id, session?.access_token, authLoading, generated]);

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
  const [directionsResult, setDirectionsResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 37.0902, lng: -95.7129 });
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

  const fetchDirections = useCallback((vehicleType) => {
    const originVal = originRef.current?.value?.trim() || origin?.trim();
    const destVal = destRef.current?.value?.trim() || dest?.trim();
    if (!originVal || !destVal) return Promise.resolve(false);
    if (!window.google) return Promise.resolve(false);

    const vehicle = vehicleType || answers.vehicle || "Car";
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
    }

    const service = new window.google.maps.DirectionsService();
    return new Promise((resolve) => {
      service.route(routeRequest, (result, status) => {
        setRouteLoading(false);
        if (status === "OK") {
          const route = result.routes[0];
          const leg = route.legs[0];
          const warnings = route.warnings || [];
          const hasTrafficDelay = warnings.some(w => /traffic|delay|congestion|slow/i.test(w))
            || route.legs.some(l => l.duration_in_traffic && l.duration_in_traffic.value > l.duration.value * 1.08);
          if (warnings.length > 0 || hasTrafficDelay) setTrafficAlert(true);

          const hours = parseHoursFromDuration(leg.duration.text);
          const miles = parseMilesFromDistance(leg.distance.text);
          const hos = isTruckVehicle(vehicle) && hours ? computeHOSCompliance(hours) : null;
          setHosCompliance(hos);
          if (isTruckVehicle(vehicle)) {
            setRvSafety(null);
            setTruckSafety({
              ...TRUCK_SAFETY_FALLBACK,
              estimatedFuelGal: miles ? Math.ceil(miles / 6) : null,
            });
          } else if (isRvVehicle(vehicle)) {
            setTruckSafety(null);
            setRvSafety({
              ...RV_SAFETY_FALLBACK,
              estimatedFuelGal: miles ? Math.ceil(miles / 9) : null,
              towing: answers.rv_towing === "Yes",
            });
          } else {
            setTruckSafety(null);
            setRvSafety(null);
          }

          const citiesAlongRoute = [];
          route.legs[0].steps.forEach(step => {
            if (!step.end_address) return;
            const parts = step.end_address.split(",").map(s => s.trim());
            if (parts.length >= 2) {
              const cityState = `${parts[parts.length - 2]}, ${parts[parts.length - 1].replace(/\s+\d{5}(-\d{4})?.*$/, "").trim()}`;
              if (cityState && !citiesAlongRoute.includes(cityState)) citiesAlongRoute.push(cityState);
            }
          });

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
          });
          setOrigin(originVal);
          setDest(destVal);
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
    if (!status) return null;
    if (status.unlimited) return "Unlimited";
    if (status.tier === "guest") return "1 free generation";
    const n = status.remaining ?? 0;
    if (n === 1) return "1 generation left";
    return `${n} generations left`;
  }

  const flowProgress = useMemo(() => getFlowProgress(answers, buildQuestionContext(answers), {
    convoComplete,
    currentQuestionId: convoComplete ? "done" : (currentQuestion?.id || "vehicle"),
  }), [answers, convoComplete, currentQuestion?.id, origin, dest, routeInfo]);

  const inQuestionFlow = !generated && (
    qIndex >= 0 ||
    Boolean(currentQuestion) ||
    (convoComplete && !returnedFromResults)
  );
  const showPlanPanelDock = tab === "plan" && !cardCollapsed && !inQuestionFlow;

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
      fetchTripCredits(session.access_token).then(setCreditStatus).catch(() => {});
    } else {
      setCreditStatus(getGuestCreditStatus());
    }
  }

  function openProfile() {
    setView("profile");
    window.scrollTo(0, 0);
  }

  function openMyTrips() {
    setView("app");
    setTab("trips");
    setCardCollapsed(false);
    window.scrollTo(0, 0);
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

  function handleManageSubscription() {
    toast_("Subscription management via Stripe — coming in Phase 10");
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
    setQIndex(-1);
    setCurrentQuestion(null);
    setQuestionHistory([]);
    setConvoComplete(false);
    setGenerated(false);
    setResultsView("planning");
    setStops([]);
    setTripTips([]);
    setRoadStops([]);
    setTripFormat(null);
    setRecommendations([]);
    setSelectedLodging([]);
    setStopCategory("all");
    setTripLegs([]);
    setPrefDraft([]);
    setHosCompliance(null);
    setTruckSafety(null);
    setRvSafety(null);
    setTripAlerts([]);
    setDismissedAlerts([]);
    setMapMarkers([]);
    setCustomStops([]);
    setNearbyServicesByCity({});
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
    setDirectionsResult(null);
    setCardCollapsed(false);
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    if (originRef.current) originRef.current.value = "";
    if (destRef.current) destRef.current.value = "";
    if (heroOriginRef.current) heroOriginRef.current.value = "";
    if (heroDestRef.current) heroDestRef.current.value = "";
    window.scrollTo(0, 0);
  }

  function handleEditTrip() {
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
    let stopId = marker.id;
    if (stopId.startsWith("stop-")) {
      stopId = `overnight-${stopId.replace("stop-", "")}`;
    }
    highlightStop(stopId);
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
  }, [directionsResult, routePath, routeInfo, mapMarkers]);

  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      return undefined;
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex(i => (i + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

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
  const stopsEndRef = useRef(null);

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
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setAutoTheme(computeAutoTheme());
    mq.addEventListener("change", updateTheme);
    const interval = setInterval(updateTheme, 60_000);
    return () => {
      mq.removeEventListener("change", updateTheme);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (currentQuestion && !stepAnim) {
      setEnterAnim(true);
      const t = setTimeout(() => setEnterAnim(false), 180);
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
    mapRef.current.setOptions({ styles: resolveMapStyles(mapStyle, theme) });
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
  }, [tripLegs, routePath, directionsResult, isLoaded, mapReady, theme, routeInfo?.scenic, answers.preferences]);

  function toast_(msg, options = false) {
    const opts = typeof options === "boolean" ? { isGold: options } : options;
    const { isGold = false, actionLabel, onAction, duration = 2400 } = opts;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastIsGold(isGold);
    setToast(msg);
    if (actionLabel && onAction) {
      setToastAction({ label: actionLabel, onClick: onAction });
    } else {
      setToastAction(null);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      setToastAction(null);
    }, actionLabel ? Math.max(duration, 8000) : duration);
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

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
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
  }, [view, generated, resultsView, showHomeAddressModal, showUpgradeModal, authModal, modal, helpMenuOpen, mapStyleOpen]);

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

  function swapRouteCities() {
    const fromVal = originRef.current?.value ?? origin;
    const toVal = destRef.current?.value ?? dest;
    if (originRef.current) originRef.current.value = toVal;
    if (destRef.current) destRef.current.value = fromVal;
    setOrigin(toVal);
    setDest(fromVal);
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

    setAnswers({});
    setConvoComplete(false);
    setGenerated(false);
    setQuestionHistory([]);
    setQIndex(-1);
    setCurrentQuestion(null);
    setTripLegs([]);
    setPrefDraft([]);
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    loadNextQuestion({});
    setHeroLaunching(false);
    requestAnimationFrame(() => scrollPlanToTop());

    fetchDirections("Car");
  }

  function loadNextQuestion(newAnswers) {
    try {
      const ctx = buildQuestionContext(newAnswers);
      const result = getNextFlowQuestion(newAnswers, ctx);
      if (!result || result.done) {
        setCurrentQuestion(null);
        setQIndex(-2);
        setConvoComplete(true);
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
      if (result.type === "trip_details" || result.type === "multiselect_group") {
        const draft = {};
        for (const sec of result.sections || []) {
          draft[sec.id] = Array.isArray(newAnswers[sec.id]) ? newAnswers[sec.id] : [];
        }
        if (result.type === "trip_details") {
          draft.trip_budget = newAnswers.trip_budget || "No budget limit";
        }
        setPrefDraft(draft);
      } else if (result.type === "multiselect") {
        setPrefDraft(Array.isArray(newAnswers[result.id]) ? newAnswers[result.id] : []);
      } else {
        setPrefDraft([]);
      }
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
    };
  }

  useEffect(() => {
    if (!currentQuestion?.pendingRoute) return;
    const ctx = buildQuestionContext(answers);
    if (!isRouteContextReady(ctx)) return;
    loadNextQuestion(answers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeInfo?.distance, routeInfo?.duration, currentQuestion?.pendingRoute, answers]);

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

  function submitAnswer(value, extraFields = {}) {
    if (!currentQuestion) return;
    try {
      let patch;
      if (currentQuestion.type === "trip_details" && value && typeof value === "object" && !Array.isArray(value)) {
        patch = { ...answers, ...extraFields, ...value };
      } else if (currentQuestion.type === "multiselect_group" && value && typeof value === "object" && !Array.isArray(value)) {
        patch = { ...answers, ...extraFields, ...value };
      } else if (currentQuestion.type === "lodging_stay") {
        patch = { ...answers, ...extraFields, lodging: value };
      } else {
        patch = { ...answers, ...extraFields, [currentQuestion.id]: value };
      }
      const ctx = buildQuestionContext(patch);
      const na = normalizeTripAnswers(patch, ctx);

      setAnswers(na);
      if (currentQuestion.id !== "_route_loading") {
        const historyQuestion = currentQuestion.type === "lodging_stay"
          ? { ...currentQuestion, _loyalty: extraFields.loyalty_program || "No preference" }
          : currentQuestion;
        setQuestionHistory(h => [...h, { question: historyQuestion, answer: value }]);
      }
      loadNextQuestion(na);
      if (currentQuestion.id === "vehicle" && originRef.current?.value && destRef.current?.value) {
        fetchDirections(na.vehicle);
      }
      if (currentQuestion.id === "fuel_type" && originRef.current?.value && destRef.current?.value) {
        fetchDirections(getEffectiveVehicle(na));
      }
      if (currentQuestion.id === "preferences" && originRef.current?.value && destRef.current?.value && na.vehicle) {
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
    try {
      if (instant) {
        submitAnswer(value, extraFields);
        return;
      }
      setEnterAnim(false);
      setStepAnim({ answer: typeof value === "string" ? value : "selected", phase: "flash" });
      if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
      stepAnimTimer.current = setTimeout(() => {
        submitAnswer(value, extraFields);
        setStepAnim(null);
      }, 70);
    } catch (err) {
      console.error("pickAnswer failed:", err);
      setStepAnim(null);
      toast_(err.message || "Could not save your answer");
    }
  }

  function toastGold(msg) {
    setToastIsGold(true);
    setToast(msg);
    setTimeout(() => { setToast(null); setToastIsGold(false); }, 2800);
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
    if (stop?.lat == null || stop?.lng == null) return;
    const id = stop.id || `focus-${stop.lat}-${stop.lng}`;
    highlightStop(id);
    focusMapOnStop({ ...stop, id });
    if (resultsView === "itinerary") {
      setResultsView("map");
    }
  }

  function addFuelStopToTrip(roadStop) {
    setRoadStops(prev => [...prev, roadStop]);
  }

  function isRoadStopAdded(stop) {
    return addedRoadStopIds.includes(roadStopKey(stop));
  }

  function addRoadStopToTrip(stop) {
    const key = roadStopKey(stop);
    if (addedRoadStopIds.includes(key)) return;
    const entry = { ...stop, id: stop.id || key, userAdded: true };
    setAddedRoadStopIds(prev => [...prev, key]);
    setRoadStops(prev => [...prev, entry]);
    if (entry.lat != null && entry.lng != null) {
      setMapMarkers(prev => [
        ...prev,
        {
          id: entry.id,
          lat: entry.lat,
          lng: entry.lng,
          category: "poi",
          title: entry.name || entry.title,
          subtitle: entry.location || entry.city || "",
          action: "add",
        },
      ]);
    }
  }

  function removeRoadStop(indexOrId) {
    setRoadStops(prev => {
      if (typeof indexOrId === "number") {
        return prev.filter((_, i) => i !== indexOrId);
      }
      return prev.filter(s => s.id !== indexOrId);
    });
  }

  function addLodgingSelection(lodging) {
    setSelectedLodging(prev => {
      const exists = prev.some(l => l.id === lodging.id);
      if (exists) return prev.filter(l => l.id !== lodging.id);
      return [...prev, lodging];
    });
  }

  function applyFallbackTrip() {
    const data = buildFallbackTripData(answers, routeInfo);
    setStops(data.stops);
    setRoadStops(data.roadStops);
    setTripTips(data.tripTips);
    if (data.hosCompliance) setHosCompliance(data.hosCompliance);
    setTruckSafety(data.truckSafety);
    setRvSafety(data.rvSafety);
  }

  function applyTripData(data) {
    const parsed = parseTripApiResponse(data, answers, routeInfo, buildFallbackTripData);
    setStops(parsed.stops);
    setRoadStops(parsed.roadStops);
    setTripTips(parsed.tripTips);
    setTripFormat(parsed.tripFormat || null);
    setRecommendations(parsed.recommendations || []);
    if (parsed.hosCompliance) setHosCompliance(parsed.hosCompliance);
    if (parsed.truckSafety !== undefined) setTruckSafety(parsed.truckSafety);
    if (parsed.rvSafety !== undefined) setRvSafety(parsed.rvSafety);
    setGenerated(true);
    setAddedRoadStopIds([]);
    setStopCategory("all");
    setTab("plan");
    setCardCollapsed(false);
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

  async function enrichAndSetTrip(parsedStops, parsedRoadStops, normalizedAnswers) {
    const mapsReady = isLoaded && !!window.google;
    setEnrichingTrip(true);
    setEnrichmentLimited(false);
    try {
      const enriched = await enrichGeneratedTrip({
        answers: normalizedAnswers,
        routeInfo,
        stops: parsedStops,
        roadStops: parsedRoadStops,
        customStops,
        selectedLodging,
        timingMode,
        departureTime: getDepartureTime(),
        origin: originRef.current?.value?.trim() || origin,
        destination: destRef.current?.value?.trim() || dest,
        mapsReady,
      });
      setStops(enriched.stops);
      setRoadStops(enriched.roadStops);
      setNearbyServicesByCity(enriched.nearbyServicesByCity);
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
      setMapMarkers(
        mapsReady
          ? enriched.mapMarkers
          : stopsToMapMarkers(enriched.stops, enriched.roadStops, customStops, [], answers),
      );
      setDismissedAlerts([]);
      if (!mapsReady) setEnrichmentLimited(true);
      return enriched;
    } catch (err) {
      console.warn("Trip enrichment failed:", err);
      setEnrichmentLimited(true);
      setMapMarkers(stopsToMapMarkers(parsedStops, parsedRoadStops, customStops, [], answers));
      return null;
    } finally {
      setEnrichingTrip(false);
    }
  }

  function addCustomStop(stop) {
    setCustomStops(prev => [...prev, stop]);
    setMapMarkers(prev => [
      ...prev,
      {
        id: stop.id,
        lat: stop.lat,
        lng: stop.lng,
        category: "custom",
        title: stop.name,
        subtitle: stop.address || stop.city,
        action: "directions",
      },
    ]);
    toast_("Custom stop added to map");
  }

  async function generateTrip() {
    const tripOrigin = originRef.current?.value?.trim() || origin;
    const tripDest = destRef.current?.value?.trim() || dest;
    if (!tripOrigin || !tripDest) {
      toast_("Enter origin and destination first");
      return;
    }

    let status = creditStatus;
    if (user && session?.access_token) {
      try {
        status = await fetchTripCredits(session.access_token);
        setCreditStatus(status);
      } catch {
        status = creditStatus;
      }
    } else {
      status = getGuestCreditStatus();
      setCreditStatus(status);
    }

    if (!status?.unlimited && (status?.remaining ?? 0) <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    if (!user) {
      if (!consumeGuestCredit()) {
        setCreditStatus(getGuestCreditStatus());
        setShowUpgradeModal(true);
        return;
      }
      setCreditStatus(getGuestCreditStatus());
    }

    setOrigin(tripOrigin);
    setDest(tripDest);
    setLoading(true);
    setEnrichmentLimited(false);
    setEnrichmentNoticeDismissed(false);

    if (isLoaded && window.google) {
      await fetchDirections(getEffectiveVehicle(answers));
    }

    const normalizedAnswers = normalizeTripAnswers(answers, buildQuestionContext(answers), { forGeneration: true });

    try {
      const activeRouteInfo = {
        ...routeInfo,
        origin: tripOrigin,
        destination: tripDest,
        scenic: isScenicRoute(answers),
      };

      let placesContext = null;
      let placesContextPrompt = "";
      if (isLoaded && window.google && activeRouteInfo.routePoints?.length) {
        placesContext = await buildPlacesContext(normalizedAnswers, activeRouteInfo);
        placesContextPrompt = formatPlacesContextForPrompt(placesContext);
      }

      const data = await generateTripPlan({
          origin: tripOrigin,
          destination: tripDest,
          answers: {
            ...normalizedAnswers,
            fuel: inferFuelType(normalizedAnswers, normalizedAnswers.preferences || [], normalizedAnswers),
          },
          routeInfo: activeRouteInfo,
          placesContext,
          placesContextPrompt,
          legs: tripLegs.length > 0 ? tripLegs : undefined,
          model: "claude-sonnet-4-20250514",
        }, session?.access_token || null);
      const parsed = parseTripApiResponse(data, normalizedAnswers, routeInfo, buildFallbackTripData);
      const tips = [...(parsed.tripTips || [])];
      if (isContinuousDrive(normalizedAnswers)) {
        tips.unshift(buildContinuousDriveTip(activeRouteInfo));
      }
      setStops(parsed.stops);
      setRoadStops(parsed.roadStops);
      setTripTips(tips);
      setTripFormat(parsed.tripFormat || null);
      setRecommendations(parsed.recommendations || []);
      if (parsed.hosCompliance) setHosCompliance(parsed.hosCompliance);
      if (parsed.truckSafety !== undefined) setTruckSafety(parsed.truckSafety);
      if (parsed.rvSafety !== undefined) setRvSafety(parsed.rvSafety);
      setGenerated(true);
      setResultsView("itinerary");
      setStopCategory("all");
      setTab("plan");
      setCardCollapsed(false);
      await enrichAndSetTrip(parsed.stops, parsed.roadStops, normalizedAnswers);
      clearPlanDraft();
      if (user && session?.access_token) {
        fetchTripCredits(session.access_token).then(setCreditStatus).catch(() => {});
      } else {
        setGuestTripPendingSave(true);
        const guestStatus = getGuestCreditStatus();
        setCreditStatus(guestStatus);
        if (guestStatus.remaining <= 0) {
          setTimeout(() => setShowUpgradeModal(true), 1200);
        }
      }
    } catch (err) {
      console.error("Generate trip error:", err);
      if (err.code === "no_credits") {
        setShowUpgradeModal(true);
        if (err.credits) setCreditStatus(err.credits);
        setLoading(false);
        return;
      }
      const fallback = buildFallbackTripData(normalizedAnswers, routeInfo);
      const fallbackTips = [...(fallback.tripTips || [])];
      if (isContinuousDrive(normalizedAnswers)) {
        fallbackTips.unshift(buildContinuousDriveTip(routeInfo));
      }
      setStops(fallback.stops);
      setRoadStops(fallback.roadStops);
      setTripTips(fallbackTips);
      setTripFormat("simplified");
      setRecommendations([]);
      if (fallback.hosCompliance) setHosCompliance(fallback.hosCompliance);
      setTruckSafety(fallback.truckSafety);
      setRvSafety(fallback.rvSafety);
      setGenerated(true);
      setResultsView("itinerary");
      setStopCategory("all");
      setTab("plan");
      setCardCollapsed(false);
      await enrichAndSetTrip(
        fallback.stops,
        fallback.roadStops,
        normalizedAnswers,
      );
      if (!user) setGuestTripPendingSave(true);
    }

    setLoading(false);
    toast_("Trip planned");
  }

  function resetPlan() {
    setReturnedFromResults(false);
    setGuestTripPendingSave(false);
    setAnswers({}); setQIndex(-1);
    setCurrentQuestion(null); setQuestionHistory([]);
    setConvoComplete(false); setGenerated(false); setStops([]); setTripTips([]); setAddedRoadStopIds([]); setEnrichingTrip(false); setEnrichmentLimited(false); setEnrichmentNoticeDismissed(false); setRoadStops([]); setTripFormat(null); setRecommendations([]); setSelectedLodging([]); setStopCategory("all");
    setTripLegs([]); setPrefDraft([]); setHosCompliance(null); setTruckSafety(null); setRvSafety(null);
    setTripAlerts([]); setDismissedAlerts([]); setMapMarkers([]); setCustomStops([]);
    setNearbyServicesByCity({}); setActivitiesByCity({}); setOptionalStopCards([]);
    setRestaurantsByCity({});
    setWeatherByCity({});
    setRouteOptimized(false);
    setNightSegmentPaths([]); setLowFuelSegmentPaths([]);
    setActiveDayIndex(0); setMapFocusTarget(null);
    setResultsView("planning");
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    clearPlanDraft();
  }

  function dismissTripAlert(alertId) {
    setDismissedAlerts(prev => [...prev, alertId]);
    setMapMarkers(prev => prev.filter(m => m.alertId !== alertId));
  }

  function handleShareItinerary() {
    const link = createItineraryShareLink({
      origin, dest, stops, roadStops, tripTips, answers, routeInfo, selectedLodging,
    });
    if (!link) {
      toast_("Could not create share link");
      return;
    }
    navigator.clipboard?.writeText(link).catch(() => {});
    toast_("Safety trip link copied — send to a trusted contact");
  }

  useEffect(() => {
    const shareId = new URLSearchParams(window.location.search).get("share");
    if (!shareId) return;
    const shared = loadSharedItinerary(shareId);
    if (!shared) return;
    setView("app");
    setOrigin(shared.origin || "");
    setDest(shared.dest || "");
    setStops(shared.stops || []);
    setRoadStops(shared.roadStops || []);
    setTripTips(shared.tripTips || []);
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
    } else {
      loadNextQuestion(draft.answers || {});
    }

    window.scrollTo(0, 0);
    requestAnimationFrame(() => scrollPlanToTop());
    fetchDirections(draft.answers?.vehicle || "Car");
  }

  function goBackOneQuestion() {
    if (questionHistory.length === 0) return;
    const history = [...questionHistory];
    const last = history.pop();
    const newAnswers = { ...answers };
    delete newAnswers[last.question.id];
    if (last.question.id === "travelers") {
      delete newAnswers.kids_ages;
    }
    if (last.question.id === "vehicle") {
      delete newAnswers.fuel_type;
      delete newAnswers.truck_height;
      delete newAnswers.truck_weight;
      delete newAnswers.truck_hazmat;
      delete newAnswers.hos_compliance;
      delete newAnswers.rv_height;
      delete newAnswers.rv_weight;
      delete newAnswers.rv_towing;
      delete newAnswers.multi_vehicles;
      delete newAnswers.primary_vehicle;
      delete newAnswers.coordination_needs;
      delete newAnswers.effective_vehicle;
    }
    if (last.question.id === "overnight_preference") {
      delete newAnswers.continuous_drive;
      delete newAnswers.lodging;
      delete newAnswers.loyalty_program;
    }
    if (last.question.id === "lodging" || last.question.type === "lodging_stay") {
      delete newAnswers.lodging;
      delete newAnswers.loyalty_program;
    }
    if (last.question.type === "multiselect_group" || last.question.type === "trip_details") {
      for (const sec of last.question.sections || []) {
        delete newAnswers[sec.id];
      }
      if (last.question.type === "trip_details") {
        delete newAnswers.trip_budget;
      }
      setPrefDraft(last.answer && typeof last.answer === "object" ? last.answer : {});
    } else if (last.question.type === "multiselect") {
      setPrefDraft(Array.isArray(last.answer) ? last.answer : []);
    } else {
      setPrefDraft([]);
    }
    setAnswers(newAnswers);
    setQuestionHistory(history);
    setCurrentQuestion(last.question);
    setQIndex(0);
    setConvoComplete(false);
  }

  function toggleTheme() {
    setThemeOverride(theme === "day" ? "night" : "day");
  }

  function handleViewTrip(trip) {
    setOrigin(trip.origin);
    setDest(trip.dest);
    setStops(trip.stops || []);
    setRoadStops(trip.roadStops || []);
    setTripTips(trip.tripTips || []);
    setAnswers(stripSessionOnlyAnswers(trip.answers || {}));
    setRouteInfo(trip.routeInfo || null);
    setSelectedLodging(trip.selectedLodging || []);
    setGenerated(true);
    setResultsView("itinerary");
    setConvoComplete(true);
    setTab("plan");
    setView("app");
    toast_("Trip loaded");
  }

  function addGroceryItem() {
    if (!groceryInput.trim()) return;
    setGroceryItems(g => [...g, groceryInput.trim()]);
    setGroceryInput("");
  }

  if (liveShareToken) {
    return <LazyLiveViewPage shareToken={liveShareToken} toast={toast_} />;
  }

  if (view === "profile" && user) {
    return (
      <>
        <div className={`app-wrap ${theme} profile-view-wrap`}>
          <NavLogo onClick={goHome} className="app-global-home-logo" />
          <nav className="nav-app nav app-nav-with-logo app-nav-minimal profile-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "var(--nav-h)", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 24px 0 148px" }}>
            <div className="nav-right app-nav-right" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <UserNavMenu
                user={user}
                profile={userProfile}
                creditStatus={creditStatus}
                onSignOut={handleSignOut}
                onRefreshCredits={refreshCredits}
                onOpenProfile={openProfile}
                onOpenTrips={openMyTrips}
              />
            </div>
          </nav>
          <ErrorBoundary label="profile" title="Could not show profile">
          <LazyProfilePage
            user={user}
            profile={userProfile}
            creditStatus={creditStatus}
            savedTrips={savedTrips}
            isLoaded={isLoaded}
            onBack={() => setView("app")}
            onSignOut={handleSignOut}
            onUpgrade={() => setShowUpgradeModal(true)}
            onPlanTrip={() => { setView("app"); setTab("plan"); setCardCollapsed(false); }}
            onLoadTrip={handleViewTrip}
            onDeleteTrip={deleteSavedTrip}
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
            toast={toast_}
          />
          </ErrorBoundary>
        </div>
        {showUpgradeModal && (
          <UpgradeModal
            onClose={() => setShowUpgradeModal(false)}
            creditStatus={creditStatus}
          />
        )}
        <Toast
          message={toast}
          isGold={toastIsGold}
          actionLabel={toastAction?.label}
          onAction={toastAction?.onClick}
        />
      </>
    );
  }

  if (view === "hero") return (
    <>
      <HeroView
        theme={theme}
        isLoaded={isLoaded}
        heroOrigin={heroOrigin}
        heroDest={heroDest}
        heroOriginError={heroOriginError}
        heroDestError={heroDestError}
        heroLaunching={heroLaunching}
        launchDisabled={!heroOrigin.trim() || !heroDest.trim() || !isLoaded || heroLaunching}
        heroSearchHover={heroSearchHover}
        heroOriginRef={heroOriginRef}
        heroDestRef={heroDestRef}
        onThemeToggle={toggleTheme}
        user={user}
        onSignOut={handleSignOut}
        onLogin={() => openAuthModal("signin")}
        onSignup={() => openAuthModal("signup")}
        onGoogle={() => handleOAuth("google")}
        onFacebook={() => handleOAuth("facebook")}
        onApple={() => handleOAuth("apple")}
        onSearchHover={setHeroSearchHover}
        onSwap={swapHeroCities}
        onHeroOriginAcLoad={ac => { heroOriginAcRef.current = ac; }}
        onHeroDestAcLoad={ac => { heroDestAcRef.current = ac; }}
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
        onShowEmailModal={() => openAuthModal("signup")}
        onShowPhoneModal={openPhoneModal}
        onGoHome={goHome}
        onOpenProfile={openProfile}
        onOpenTrips={openMyTrips}
        userProfile={userProfile}
        creditStatus={creditStatus}
        onRefreshCredits={refreshCredits}
        planDraft={planDraft}
        onResumeDraft={resumePlanDraft}
      />
      {authModal === "signup" && (
        <EmailModal
          email={heroEmail}
          onEmailChange={setHeroEmail}
          onClose={() => setAuthModal(null)}
          onSignUp={handleEmailSignUp}
          onSwitchToSignIn={() => openAuthModal("signin")}
          onContinueWithPhone={() => { setAuthModal(null); openPhoneModal(); }}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
        />
      )}
      {authModal === "phone" && (
        <PhoneModal
          onClose={() => { setAuthModal(null); setAuthPhone(""); setAuthError(""); }}
          onSendCode={handlePhoneSendCode}
          onVerifyCode={handlePhoneVerify}
          onResendCode={handlePhoneResend}
          initialPhone={authPhone}
          loading={authBusy}
          error={authError}
        />
      )}
      {authModal === "signin" && (
        <SignInModal
          onClose={() => setAuthModal(null)}
          onSignIn={handleSignInSubmit}
          onForgotPassword={handleForgotPassword}
          onSwitchToSignup={() => openAuthModal("signup")}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
        />
      )}
      {!isAuthConfigured && authModal?.startsWith("oauth-") && (
        <OAuthComingSoonModal
          provider={authModal.replace("oauth-", "")}
          onClose={() => setAuthModal(null)}
          onUseEmail={() => openAuthModal("signup")}
        />
      )}
      <Toast
        message={toast}
        isGold={toastIsGold}
        actionLabel={toastAction?.label}
        onAction={toastAction?.onClick}
      />
    </>
  );

  return (
    <>
      <div className={`app-wrap ${theme}${generated && resultsView === "itinerary" ? " results-fullscreen" : ""}${generated && resultsView === "map" ? " map-fullscreen-mode" : ""}`} style={{
        display: "flex", flexDirection: "column", height: "100vh",
        transition: "color 1.8s ease",
      }}>
        <NavLogo onClick={goHome} className="app-global-home-logo" />
        <nav className="nav-app nav app-nav-with-logo app-nav-minimal" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "var(--nav-h)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px 0 148px" }}>
          <div className="nav-logo-spacer" aria-hidden="true"/>
          <div className="nav-center-wrap nav-center" style={{ display: "flex", gap: "4px", borderRadius: 8, padding: 4, alignItems: "center" }}>
            {!(generated && resultsView === "map") && (
              <>
                {[["plan", "Plan"], ["trips", "Trips"], ["share", "Share"]].map(([k, l]) => (
                  <button key={k} className={"nav-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{l}</button>
                ))}
                <button
                  type="button"
                  className={`nav-tab nav-tab-profile${view === "profile" ? " active" : ""}`}
                  onClick={() => (user ? openProfile() : openAuthModal("signin"))}
                >
                  Profile
                </button>
              </>
            )}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <div className="nav-right app-nav-right" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {liveSharingActive && (
              <span className="nav-live-badge" title="Live location sharing active">
                <span className="nav-live-badge-dot" aria-hidden="true" />
                LIVE
              </span>
            )}
            {user ? (
              <UserNavMenu
                user={user}
                profile={userProfile}
                creditStatus={creditStatus}
                onSignOut={handleSignOut}
                onRefreshCredits={refreshCredits}
                onOpenProfile={openProfile}
                onOpenTrips={openMyTrips}
              />
            ) : (
              <button type="button" className="nav-btn nav-btn-ghost" onClick={() => openAuthModal("signin")}>Log in</button>
            )}
          </div>
        </nav>

        {generated && resultsView === "itinerary" ? (
          <ErrorBoundary label="results" title="Could not show trip results">
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
            liveTipsUpdatedAt={liveTipsUpdatedAt}
            liveTipsRefreshing={liveTipsRefreshing}
            enrichingTrip={enrichingTrip}
            enrichmentLimited={enrichmentLimited && !enrichmentNoticeDismissed}
            onDismissEnrichmentNotice={() => setEnrichmentNoticeDismissed(true)}
            isStopAdded={isRoadStopAdded}
            activitiesByCity={activitiesByCity}
            restaurantsByCity={restaurantsByCity}
            weatherByCity={weatherByCity}
            routeOptimized={routeOptimized}
            departureTime={departureTime}
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
            onAddFuelStop={addFuelStopToTrip}
            onLodgingSelect={addLodgingSelection}
            onDismissAlert={dismissTripAlert}
            onShare={handleShareItinerary}
            onToast={toast_}
            onStopSelect={handleResultsStopSelect}
            onGuestSignUp={() => openAuthModal("signup")}
            onDismissGuestBanner={() => setGuestBannerDismissed(true)}
          />
          </ErrorBoundary>
        ) : generated && resultsView === "map" ? (
          <div className="trip-map-fullscreen view-panel-animate">
            <div className="map-float-nav">
              <button type="button" className="map-float-pill" onClick={() => setResultsView("itinerary")}>← Your Trip</button>
              <button type="button" className="map-float-pill" onClick={handleEditTrip}>Edit Trip</button>
            </div>
            <AppMap
              isLoaded={isLoaded}
              mapCenter={mapCenter}
              mapStyle={mapStyle}
              mapStyleOpen={mapStyleOpen}
              trafficAlert={trafficAlert}
              routeLoading={routeLoading}
              tripGenerating={loading}
              loadingMessageIndex={loadingMessageIndex}
              isDarkMode={theme === "night"}
              theme={theme}
              mapRef={mapRef}
              directions={tripLegs.length === 0 ? directionsResult : null}
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
              onMapReady={() => setMapReady(true)}
              onMapStyleOpenChange={setMapStyleOpen}
              onMapStyleChange={setMapStyle}
              onRecenter={recenterMap}
              onMarkerSelect={handleMapMarkerSelect}
              onNavigateHome={handleNavigateHome}
              navigateHomePending={navigateHomePending}
              onMarkerAction={(action, marker) => {
                if (action === "add") toast_("Added to trip");
                focusMapOnStop(marker);
              }}
            />
          </div>
        ) : (
        <div className="app">
          <AppMap
            isLoaded={isLoaded}
            mapCenter={mapCenter}
            mapStyle={mapStyle}
            mapStyleOpen={mapStyleOpen}
            trafficAlert={trafficAlert}
            routeLoading={routeLoading}
            tripGenerating={loading}
            loadingMessageIndex={loadingMessageIndex}
            isDarkMode={theme === "night"}
            theme={theme}
            mapRef={mapRef}
            directions={tripLegs.length === 0 ? directionsResult : null}
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
            onMapStyleOpenChange={setMapStyleOpen}
            onMapStyleChange={setMapStyle}
            onRecenter={recenterMap}
            onMarkerSelect={handleMapMarkerSelect}
            showRoutePill={false}
            onMarkerAction={(action, marker) => {
              if (action === "add") toast_("Added to trip");
            }}
          />

          <div className={`float-card ${theme} ${cardCollapsed ? "collapsed" : ""}${helpMenuOpen ? " help-open" : ""}${inQuestionFlow ? " float-card--plan-flow" : ""}`}>
            <div
              className={`float-card-header${inQuestionFlow ? " float-card-header--plan-flow" : ""}`}
              onClick={handlePanelHeaderClick}
              onTouchStart={handlePanelTouchStart}
              onTouchMove={handlePanelTouchMove}
              onTouchEnd={handlePanelTouchEnd}
            >
              <div className="float-card-handle" aria-hidden="true"/>
              <div className="float-card-header-row">
                <div className="float-card-title">
                  {tab === "plan" ? "Plan Your Trip" : tab === "trips" ? "Trips" : "Live Sharing"}
                </div>
                <div className="float-card-header-actions" onClick={e => e.stopPropagation()}>
                  <div className="float-card-help-wrap" ref={helpWrapRef}>
                    <button type="button" className="float-card-help-btn" onClick={() => setHelpMenuOpen(o => !o)} aria-label="Help">?</button>
                    {helpMenuOpen && (
                      <div className="help-menu">
                        <button type="button" className="help-menu-item" onClick={() => { window.open("https://tripmappa.com/help", "_blank"); setHelpMenuOpen(false); }}>Help center</button>
                        <button type="button" className="help-menu-item" onClick={() => { setModal({ type: "report" }); setHelpMenuOpen(false); }}>Report an issue</button>
                      </div>
                    )}
                  </div>
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
            </div>
            <div className={`float-card-body${inQuestionFlow ? " float-card-body--plan-flow" : ""}`}>
              <div className="float-card-scroll" ref={floatCardScrollRef}>
                <div className="sidebar-inner" style={{ background: "transparent" }}>
                  {tab === "plan" && (
                    <ErrorBoundary label="plan-panel" title="Could not show planner">
                    <PlanPanel
                      qIndex={qIndex}
                      currentQuestion={currentQuestion}
                      convoComplete={convoComplete}
                      loading={loading}
                      answers={answers}
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
                      flowProgress={flowProgress}
                      returnedFromResults={returnedFromResults}
                      inQuestionFlow={inQuestionFlow}
                      onGenerateTrip={generateTrip}
                      onResetPlan={resetPlan}
                      onGoBack={goBackOneQuestion}
                      onPickAnswer={pickAnswer}
                      onSetAnswers={setAnswers}
                      onSetPrefDraft={setPrefDraft}
                      getStepMessage={getStepMessage}
                    />
                    </ErrorBoundary>
                  )}
                  {tab === "trips" && (
                    <TripsPanel
                      savedTrips={savedTrips}
                      onViewTrip={handleViewTrip}
                      onDeleteTrip={deleteSavedTrip}
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

      {modal?.type === "grocery" && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <GroceryModal
            city={modal.city}
            groceryInput={groceryInput}
            groceryItems={groceryItems}
            onInputChange={setGroceryInput}
            onAddItem={addGroceryItem}
            onClose={() => setModal(null)}
            onPlaceOrder={() => { toast_("Grocery order placed"); setModal(null); }}
          />
        </div>
      )}
      {modal?.type === "report" && (
        <ReportIssueModal
          reportText={reportText}
          onTextChange={setReportText}
          onClose={() => { setModal(null); setReportText(""); }}
          onSubmit={() => { toast_("Thanks — we'll review your report"); setModal(null); setReportText(""); }}
        />
      )}
      {authModal === "signup" && (
        <EmailModal
          email={heroEmail}
          onEmailChange={setHeroEmail}
          onClose={() => setAuthModal(null)}
          onSignUp={handleEmailSignUp}
          onSwitchToSignIn={() => openAuthModal("signin")}
          onContinueWithPhone={() => { setAuthModal(null); openPhoneModal(); }}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
        />
      )}
      {authModal === "phone" && (
        <PhoneModal
          onClose={() => { setAuthModal(null); setAuthPhone(""); setAuthError(""); }}
          onSendCode={handlePhoneSendCode}
          onVerifyCode={handlePhoneVerify}
          onResendCode={handlePhoneResend}
          initialPhone={authPhone}
          loading={authBusy}
          error={authError}
        />
      )}
      {authModal === "signin" && (
        <SignInModal
          onClose={() => setAuthModal(null)}
          onSignIn={handleSignInSubmit}
          onForgotPassword={handleForgotPassword}
          onSwitchToSignup={() => openAuthModal("signup")}
          onGoogle={() => handleOAuth("google")}
          onFacebook={() => handleOAuth("facebook")}
          onApple={() => handleOAuth("apple")}
          loading={authBusy}
          error={authError}
        />
      )}
      {!isAuthConfigured && authModal?.startsWith("oauth-") && (
        <OAuthComingSoonModal
          provider={authModal.replace("oauth-", "")}
          onClose={() => setAuthModal(null)}
          onUseEmail={() => openAuthModal("signup")}
        />
      )}
      {showUpgradeModal && (
        <UpgradeModal
          creditStatus={creditStatus || getGuestCreditStatus()}
          onClose={() => setShowUpgradeModal(false)}
          onSignUp={() => { setShowUpgradeModal(false); openAuthModal("signup"); }}
        />
      )}
      {showHomeAddressModal && (
        <HomeAddressModal
          isLoaded={isLoaded}
          initialAddress={homeAddress || getGuestHomeAddress()}
          onSave={handleSaveHomeAddress}
          onClose={() => { setShowHomeAddressModal(false); setNavigateHomePending(false); }}
        />
      )}
      <Toast
        message={toast}
        isGold={toastIsGold}
        actionLabel={toastAction?.label}
        onAction={toastAction?.onClick}
      />
    </>
  );
}
