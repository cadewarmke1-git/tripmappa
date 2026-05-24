/**
 * TripMappa root orchestrator (~710 lines).
 * State, effects, handlers, and layout only — logic lives in src/lib/, UI in src/components/.
 * See ROADMAP.md for phase status and conventions.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_LIBRARIES, LEG_MAP_STYLES } from "./lib/constants.js";
import {
  isTruckVehicle,
  isRvVehicle,
  hasPref,
  isScenicRoute,
  inferFuelType,
} from "./lib/vehicles.js";
import { fetchNextQuestion, getNextFlowQuestion } from "./lib/tripFlow.js";
import { computeHOSCompliance } from "./lib/hos.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./lib/parsing.js";
import { computeAutoTheme } from "./lib/theme.js";
import { TRUCK_SAFETY_FALLBACK, RV_SAFETY_FALLBACK } from "./lib/tripData.js";
import { generateTripPlan } from "./lib/apiClient.js";
import { buildFallbackTripData, parseTripApiResponse } from "./lib/tripHandlers.js";
import HeroView from "./components/HeroView.jsx";
import AppMap from "./components/AppMap.jsx";
import PlanPanel from "./components/PlanPanel.jsx";
import TripsPanel from "./components/TripsPanel.jsx";
import SharePanel from "./components/SharePanel.jsx";
import GroceryModal from "./components/GroceryModal.jsx";
import EmailModal from "./components/EmailModal.jsx";
import ReportIssueModal from "./components/ReportIssueModal.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Toast from "./components/Toast.jsx";

export default function App() {
  const [view, setView] = useState("hero"); // "hero" | "app"
  const [tab, setTab] = useState("plan");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [heroOrigin, setHeroOrigin] = useState("");
  const [heroDest, setHeroDest] = useState("");
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSearchHover, setHeroSearchHover] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [timingMode, setTimingMode] = useState("leave_now");
  const [arriveByDate, setArriveByDate] = useState("");
  const [routeTimingOpen, setRouteTimingOpen] = useState(false);
  const [prefDraft, setPrefDraft] = useState([]);
  const [prefSkipReady, setPrefSkipReady] = useState(false);
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
  const [convoLoading, setConvoLoading] = useState(false);
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [stops, setStops] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [roadStops, setRoadStops] = useState([]);
  const [tripLegs, setTripLegs] = useState([]);
  const [stopCategory, setStopCategory] = useState("all");
  const [savedTrips, setSavedTrips] = useState(() => {
    try { return JSON.parse(localStorage.getItem("tripmappa-saved") || "[]"); } catch { return []; }
  });

  function saveTripComingSoon() {
    toast_("Sign in to save trips — coming in Phase 6");
  }

  function deleteSavedTrip(id) {
    const updated = savedTrips.filter(t => t.id !== id);
    setSavedTrips(updated);
    try { localStorage.setItem("tripmappa-saved", JSON.stringify(updated)); } catch {}
    toast_("Trip removed");
  }
  const [toast, setToast] = useState(null);
  const [toastIsGold, setToastIsGold] = useState(false);
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

  // ── Google Maps ──
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
  });
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 37.0902, lng: -95.7129 });
  const originRef = useRef(null);
  const destRef = useRef(null);
  const heroOriginRef = useRef(null);
  const heroDestRef = useRef(null);
  const mapRef = useRef(null);
  const polylineRef = useRef(null);
  const polylinesRef = useRef([]);

  const fetchDirections = useCallback((vehicleType) => {
    const originVal = originRef.current?.value;
    const destVal = destRef.current?.value;
    if (!originVal || !destVal) return;

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

    if (isTruckVehicle(vehicleType)) {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    } else if (isRvVehicle(vehicleType)) {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    }

    if (scenic || hasPref(answers, "Avoid highways")) routeRequest.avoidHighways = true;
    if (hasPref(answers, "Avoid tolls")) routeRequest.avoidTolls = true;

    const service = new window.google.maps.DirectionsService();
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
        const hos = isTruckVehicle(vehicleType) && hours ? computeHOSCompliance(hours) : null;
        setHosCompliance(hos);
        if (isTruckVehicle(vehicleType)) {
          setRvSafety(null);
          setTruckSafety({
            ...TRUCK_SAFETY_FALLBACK,
            estimatedFuelGal: miles ? Math.ceil(miles / 6) : null,
          });
        } else if (isRvVehicle(vehicleType)) {
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

        setRouteInfo({
          distance: leg.distance.text,
          duration: leg.duration.text,
          start: leg.start_address.split(",")[0],
          end: leg.end_address.split(",")[0],
          vehicleType: vehicleType || "Car",
          timingMode,
          arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
          scenic,
          truckSafe: isTruckVehicle(vehicleType),
          rvSafe: isRvVehicle(vehicleType),
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

        if (mapRef.current) {
          const bounds = new window.google.maps.LatLngBounds();
          route.legs[0].steps.forEach(step => {
            bounds.extend(step.start_location);
            bounds.extend(step.end_location);
          });
          mapRef.current.fitBounds(bounds, { padding: 60 });
        }
      }
    });
  }, [timingMode, arriveByDate, answers]);

  const convoEndRef = useRef(null);
  const stopsEndRef = useRef(null);
  useEffect(()=>{ convoEndRef.current?.scrollIntoView({behavior:"smooth"}); },[qIndex, generated]);

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
    if (currentQuestion && !stepAnim && !convoLoading) {
      setEnterAnim(true);
      const t = setTimeout(() => setEnterAnim(false), 350);
      return () => clearTimeout(t);
    }
  }, [currentQuestion?.id, convoLoading, stepAnim]);

  useEffect(() => {
    if (generated && (stops.length > 0 || roadStops.length > 0)) {
      setCardCollapsed(false);
      setTab("plan");
      requestAnimationFrame(() => {
        convoEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [generated, stops, roadStops]);

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
    mapRef.current.setOptions({
      styles: mapStyle === "dark" ? DARK_MAP_STYLES : mapStyle === "standard" ? STANDARD_MAP_STYLES : null,
    });
  }, [mapStyle, isLoaded]);

  useEffect(() => {
    if (!mapRef.current || !window.google || !isLoaded) return;
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;

    const drawLine = (path, style) => {
      if (!path?.length) return;
      const opts = {
        path,
        geodesic: true,
        strokeColor: style.color,
        strokeOpacity: style.dashed ? 0 : 0.9,
        strokeWeight: 5,
        map: mapRef.current,
      };
      if (style.dashed) {
        opts.icons = [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0",
          repeat: "16px",
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
    } else if (routePath) {
      const scenic = routeInfo?.scenic || isScenicRoute(answers);
      drawLine(routePath, { color: scenic ? "rgba(255,170,100,0.85)" : "rgba(255,140,0,0.9)", dashed: false });
    }

    if (hasBounds) mapRef.current.fitBounds(bounds, { padding: 60 });
  }, [tripLegs, routePath, isLoaded, routeInfo?.scenic, answers.preferences]);

  function toast_(msg) {
    setToastIsGold(false);
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function swapHeroCities() {
    const fromVal = heroOriginRef.current?.value ?? heroOrigin;
    const toVal = heroDestRef.current?.value ?? heroDest;
    if (heroOriginRef.current) heroOriginRef.current.value = toVal;
    if (heroDestRef.current) heroDestRef.current.value = fromVal;
    setHeroOrigin(toVal);
    setHeroDest(fromVal);
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

  function launchFromHero() {
    const from = heroOriginRef.current?.value || heroOrigin;
    const to = heroDestRef.current?.value || heroDest;
    if (!from || !to) { toast_("Enter your starting point and destination"); return; }
    setHeroOrigin(from); setHeroDest(to);
    setOrigin(from); setDest(to);
    setView("app");
    window.scrollTo(0,0);
    setTimeout(()=>{
      if (originRef.current) originRef.current.value = from;
      if (destRef.current) destRef.current.value = to;
      if (isLoaded && window.google && answers.vehicle) fetchDirections(answers.vehicle);
      setAnswers({});
      setConvoComplete(false);
      setGenerated(false);
      setQuestionHistory([]);
      setCurrentQuestion(null);
      setTripLegs([]);
      loadNextQuestion({});
    }, 300);
  }

  async function loadNextQuestion(newAnswers) {
    setConvoLoading(true);
    try {
      const result = await fetchNextQuestion(newAnswers);
      if (result.done) {
        setCurrentQuestion(null);
        setQIndex(-2);
        setConvoComplete(true);
      } else {
        setCurrentQuestion(result);
        setQIndex(0);
        if (result.id === "preferences") {
          setPrefDraft(Array.isArray(newAnswers.preferences) ? newAnswers.preferences : []);
          setPrefSkipReady(false);
        }
      }
    } catch (err) {
      console.error("Question flow failed:", err);
      const fallback = getNextFlowQuestion(newAnswers);
      if (fallback.done) {
        setCurrentQuestion(null);
        setQIndex(-2);
        setConvoComplete(true);
      } else {
        setCurrentQuestion(fallback);
        setQIndex(0);
      }
    } finally {
      setConvoLoading(false);
    }
  }

  useEffect(() => {
    if (currentQuestion?.id !== "preferences") return;
    setPrefSkipReady(false);
    const t = setTimeout(() => setPrefSkipReady(true), 3000);
    return () => clearTimeout(t);
  }, [currentQuestion?.id]);

  async function startConvo() {
    if (!origin || !dest) { toast_("Enter origin and destination first"); return; }
    setAnswers({});
    setQuestionHistory([]);
    setConvoComplete(false);
    setTripLegs([]);
    setPrefDraft([]);
    await loadNextQuestion({});
  }

  function getStepMessage() {
    if (qIndex === -2) return "Got it. Ready to generate your trip plan?";
    if (convoLoading) return "One sec…";
    if (currentQuestion) return currentQuestion.ask;
    return null;
  }

  async function submitAnswer(value, extraFields = {}) {
    if (!currentQuestion) return;
    const na = { ...answers, ...extraFields, [currentQuestion.id]: value };

    setAnswers(na);
    setQuestionHistory(h => [...h, { question: currentQuestion, answer: value }]);
    await loadNextQuestion(na);
    if (currentQuestion.id === "vehicle" && originRef.current?.value && destRef.current?.value) {
      fetchDirections(na.vehicle);
    }
    if (currentQuestion.id === "preferences" && originRef.current?.value && destRef.current?.value && na.vehicle) {
      fetchDirections(na.vehicle);
    }
  }

  function pickAnswer(value, extraFields) {
    if (stepAnim || convoLoading) return;
    setEnterAnim(false);
    setStepAnim({ answer: typeof value === "string" ? value : "selected", phase: "flash" });
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    stepAnimTimer.current = setTimeout(() => {
      setStepAnim(prev => prev ? { ...prev, phase: "exit" } : null);
      stepAnimTimer.current = setTimeout(async () => {
        await submitAnswer(value, extraFields);
        setStepAnim(null);
      }, 300);
    }, 150);
  }

  function toastGold(msg) {
    setToastIsGold(true);
    setToast(msg);
    setTimeout(() => { setToast(null); setToastIsGold(false); }, 2800);
  }

  useEffect(() => () => { if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current); }, []);

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
    if (parsed.hosCompliance) setHosCompliance(parsed.hosCompliance);
    if (parsed.truckSafety !== undefined) setTruckSafety(parsed.truckSafety);
    if (parsed.rvSafety !== undefined) setRvSafety(parsed.rvSafety);
    setGenerated(true);
    setStopCategory("all");
    setTab("plan");
    setCardCollapsed(false);
  }

  async function generateTrip() {
    const tripOrigin = originRef.current?.value?.trim() || origin;
    const tripDest = destRef.current?.value?.trim() || dest;
    if (!tripOrigin || !tripDest) {
      toast_("Enter origin and destination first");
      return;
    }
    setOrigin(tripOrigin);
    setDest(tripDest);
    setLoading(true);

    if (isLoaded && window.google) {
      fetchDirections(answers.vehicle);
    }

    try {
      const data = await generateTripPlan({
          origin: tripOrigin,
          destination: tripDest,
          answers: {
            ...answers,
            fuel: inferFuelType(answers.vehicle, answers.preferences || []),
          },
          routeInfo: { ...routeInfo, scenic: isScenicRoute(answers) },
          legs: tripLegs.length > 0 ? tripLegs : undefined,
          model: "claude-sonnet-4-20250514",
        });
      if (!response.ok) throw new Error(data.error || "Failed to generate trip");
      applyTripData(data);
    } catch (err) {
      console.error("Generate trip error:", err);
      applyFallbackTrip();
      setGenerated(true);
      setStopCategory("all");
      setTab("plan");
      setCardCollapsed(false);
    }

    setLoading(false);
    toast_("Trip planned");
  }

  function resetPlan() {
    setAnswers({}); setQIndex(-1);
    setCurrentQuestion(null); setQuestionHistory([]); setConvoLoading(false);
    setConvoComplete(false); setGenerated(false); setStops([]); setTripTips([]); setRoadStops([]); setStopCategory("all");
    setTripLegs([]); setPrefDraft([]); setHosCompliance(null); setTruckSafety(null); setRvSafety(null);
    setStepAnim(null);
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
  }

  function goBackOneQuestion() {
    if (questionHistory.length === 0) return;
    const history = [...questionHistory];
    const last = history.pop();
    const newAnswers = { ...answers };
    delete newAnswers[last.question.id];
    if (last.question.id === "vehicle") {
      delete newAnswers.truck_height;
      delete newAnswers.truck_weight;
      delete newAnswers.truck_hazmat;
      delete newAnswers.rv_height;
      delete newAnswers.rv_weight;
      delete newAnswers.rv_towing;
    }
    if (last.question.id === "travelers") delete newAnswers.kids_ages;
    setAnswers(newAnswers);
    setQuestionHistory(history);
    setCurrentQuestion(last.question);
    setQIndex(0);
    setConvoComplete(false);
    setPrefDraft([]);
  }

  function toggleTheme() {
    setThemeOverride(theme === "day" ? "night" : "day");
  }

  function handleViewTrip(trip) {
    setOrigin(trip.origin);
    setDest(trip.dest);
    setStops(trip.stops || []);
    setTripTips(trip.tripTips || []);
    setAnswers(trip.answers || {});
    setGenerated(true);
    setConvoComplete(true);
    setTab("plan");
    toast_("Trip loaded");
  }

  function addGroceryItem() {
    if (!groceryInput.trim()) return;
    setGroceryItems(g => [...g, groceryInput.trim()]);
    setGroceryInput("");
  }

  if (view === "hero") return (
    <>
      <HeroView
        theme={theme}
        isLoaded={isLoaded}
        heroOrigin={heroOrigin}
        heroDest={heroDest}
        heroSearchHover={heroSearchHover}
        heroOriginRef={heroOriginRef}
        heroDestRef={heroDestRef}
        onThemeToggle={toggleTheme}
        onLogin={() => setView("app")}
        onSignup={() => setView("app")}
        onSearchHover={setHeroSearchHover}
        onSwap={swapHeroCities}
        onHeroOriginPlaceChanged={() => { if (heroOriginRef.current) setHeroOrigin(heroOriginRef.current.value); }}
        onHeroDestPlaceChanged={() => { if (heroDestRef.current) setHeroDest(heroDestRef.current.value); }}
        onHeroOriginChange={setHeroOrigin}
        onHeroDestChange={setHeroDest}
        onLaunch={launchFromHero}
        onShowEmailModal={() => setShowEmailModal(true)}
      />
      {showEmailModal && (
        <EmailModal
          email={heroEmail}
          onEmailChange={setHeroEmail}
          onClose={() => setShowEmailModal(false)}
          onContinue={() => { if (heroEmail.trim()) { setShowEmailModal(false); setView("app"); } else toast_("Enter your email"); }}
          onContinueWithEnter={() => { if (heroEmail.trim()) { setShowEmailModal(false); setView("app"); } }}
        />
      )}
      <Toast message={toast} isGold={toastIsGold} />
    </>
  );

  return (
    <>
      <div className={`app-wrap ${theme}`} style={{
        display: "flex", flexDirection: "column", height: "100vh",
        transition: "color 1.8s ease",
      }}>
        <nav className="nav-app nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "var(--nav-h)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div className="nav-logo">Trip<span>Mappa</span></div>
          <div className="nav-center-wrap nav-center" style={{ display: "flex", gap: "1px", borderRadius: 8, padding: 3 }}>
            {[["plan", "Plan"], ["trips", "Trips"], ["share", "Share"]].map(([k, l]) => (
              <button key={k} className={"nav-tab" + (tab === k ? " active" : "")} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="nav-right" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" className="nav-btn" onClick={saveTripComingSoon}>Save trip</button>
            <button type="button" className="nav-btn nav-btn-primary" onClick={() => toast_("Link copied")}>Share</button>
          </div>
        </nav>

        <div className="app">
          <AppMap
            isLoaded={isLoaded}
            mapCenter={mapCenter}
            mapStyle={mapStyle}
            mapStyleOpen={mapStyleOpen}
            trafficAlert={trafficAlert}
            routeLoading={routeLoading}
            isDarkMode={theme === "night"}
            mapRef={mapRef}
            polylinesRef={polylinesRef}
            polylineRef={polylineRef}
            onMapStyleOpenChange={setMapStyleOpen}
            onMapStyleChange={setMapStyle}
          />

          <div className={`float-card ${theme} ${cardCollapsed ? "collapsed" : ""}`}>
            <div className="float-card-header" onClick={() => setCardCollapsed(c => !c)}>
              <div className="float-card-handle" aria-hidden="true"/>
              <div className="float-card-header-row">
                <div className="float-card-title">
                  {tab === "plan" ? "Plan Your Trip" : tab === "trips" ? "Trips" : "Live Sharing"}
                </div>
                <div className="float-card-header-actions" onClick={e => e.stopPropagation()}>
                  <div className="float-card-help-wrap">
                    <button type="button" className="float-card-help-btn" onClick={() => setHelpMenuOpen(o => !o)} aria-label="Help">?</button>
                    {helpMenuOpen && (
                      <div className="help-menu">
                        <button type="button" className="help-menu-item" onClick={() => { window.open("https://tripmappa.com/help", "_blank"); setHelpMenuOpen(false); }}>Help center</button>
                        <button type="button" className="help-menu-item" onClick={() => { setModal({ type: "report" }); setHelpMenuOpen(false); }}>Report an issue</button>
                      </div>
                    )}
                  </div>
                  <span className={`float-card-chevron ${cardCollapsed ? "" : "open"}`}>▼</span>
                </div>
              </div>
            </div>
            <div className="float-card-body">
              <div className="float-card-scroll">
                <div className="sidebar-inner" style={{ background: "transparent" }}>
                  {tab === "plan" && (
                    <PlanPanel
                      generated={generated}
                      stops={stops}
                      roadStops={roadStops}
                      tripTips={tripTips}
                      qIndex={qIndex}
                      currentQuestion={currentQuestion}
                      convoLoading={convoLoading}
                      convoComplete={convoComplete}
                      loading={loading}
                      answers={answers}
                      routeInfo={routeInfo}
                      tripLegs={tripLegs}
                      stepAnim={stepAnim}
                      enterAnim={enterAnim}
                      prefDraft={prefDraft}
                      prefSkipReady={prefSkipReady}
                      questionHistoryLength={questionHistory.length}
                      origin={origin}
                      dest={dest}
                      stopCategory={stopCategory}
                      truckSafety={truckSafety}
                      rvSafety={rvSafety}
                      hosCompliance={hosCompliance}
                      isLoaded={isLoaded}
                      timingMode={timingMode}
                      routeTimingOpen={routeTimingOpen}
                      arriveByDate={arriveByDate}
                      originRef={originRef}
                      destRef={destRef}
                      convoEndRef={convoEndRef}
                      stopsEndRef={stopsEndRef}
                      onStartConvo={startConvo}
                      onGenerateTrip={generateTrip}
                      onResetPlan={resetPlan}
                      onGoBack={goBackOneQuestion}
                      onPickAnswer={pickAnswer}
                      onSetAnswers={setAnswers}
                      onSetPrefDraft={setPrefDraft}
                      onSaveTrip={saveTripComingSoon}
                      onToast={toast_}
                      onToastGold={toastGold}
                      onGroceryModal={city => setModal({ type: "grocery", city })}
                      onStopCategoryChange={setStopCategory}
                      onSwapRoute={swapRouteCities}
                      onFetchDirections={fetchDirections}
                      onSetOrigin={setOrigin}
                      onSetDest={setDest}
                      onSetTimingMode={setTimingMode}
                      onSetRouteTimingOpen={setRouteTimingOpen}
                      onSetArriveByDate={setArriveByDate}
                      onRetryGenerate={() => { setGenerated(false); generateTrip(); }}
                      getStepMessage={getStepMessage}
                    />
                  )}
                  {tab === "trips" && (
                    <TripsPanel
                      savedTrips={savedTrips}
                      onViewTrip={handleViewTrip}
                      onDeleteTrip={deleteSavedTrip}
                      onPlanTrip={() => { setTab("plan"); setCardCollapsed(false); }}
                    />
                  )}
                  {tab === "share" && <SharePanel onCopyLink={() => toast_("Link copied")} />}
                </div>
              </div>
            </div>
          </div>
        </div>
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
      <Toast message={toast} isGold={toastIsGold} />
    </>
  );
}
