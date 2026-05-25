/**
 * TripMappa root orchestrator (~710 lines).
 * State, effects, handlers, and layout only — logic lives in src/lib/, UI in src/components/.
 * See ROADMAP.md for phase status and conventions.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_LIBRARIES, LEG_MAP_STYLES, STANDARD_MAP_STYLES, DARK_MAP_STYLES, NIGHT_MAP_STYLES } from "./lib/constants.js";
import {
  isTruckVehicle,
  isRvVehicle,
  hasPref,
  isScenicRoute,
  inferFuelType,
  getEffectiveVehicle,
} from "./lib/vehicles.js";
import { getNextFlowQuestion, getFlowCompleteMessage, normalizeTripAnswers } from "./lib/tripFlow.js";
import { computeHOSCompliance } from "./lib/hos.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./lib/parsing.js";
import { computeAutoTheme } from "./lib/theme.js";
import { TRUCK_SAFETY_FALLBACK, RV_SAFETY_FALLBACK } from "./lib/tripData.js";
import { generateTripPlan } from "./lib/apiClient.js";
import { buildFallbackTripData, parseTripApiResponse } from "./lib/tripHandlers.js";
import { resolvePlaceFromAutocomplete } from "./lib/places.js";
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
  const [heroOriginError, setHeroOriginError] = useState("");
  const [heroDestError, setHeroDestError] = useState("");
  const [heroLaunching, setHeroLaunching] = useState(false);
  const [heroEmail, setHeroEmail] = useState("");
  const [heroSearchHover, setHeroSearchHover] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [timingMode, setTimingMode] = useState("leave_now");
  const [arriveByDate, setArriveByDate] = useState("");
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
  const [convoComplete, setConvoComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [stops, setStops] = useState([]);
  const [tripTips, setTripTips] = useState([]);
  const [roadStops, setRoadStops] = useState([]);
  const [selectedLodging, setSelectedLodging] = useState([]);
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
  const helpWrapRef = useRef(null);

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
    if (currentQuestion && !stepAnim) {
      setEnterAnim(true);
      const t = setTimeout(() => setEnterAnim(false), 350);
      return () => clearTimeout(t);
    }
  }, [currentQuestion?.id, stepAnim]);

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
    let styles = [];
    if (mapStyle === "dark") styles = DARK_MAP_STYLES;
    else if (mapStyle === "standard" && theme === "night") styles = NIGHT_MAP_STYLES;
    else if (mapStyle === "standard") styles = STANDARD_MAP_STYLES;
    mapRef.current.setOptions({ styles });
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
    const ROUTE_GOLD = "#FFD28C";

    const drawLine = (path, style) => {
      if (!path?.length) return;
      const color = style.color || ROUTE_GOLD;
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

    fetchDirections("Car");
  }

  function loadNextQuestion(newAnswers) {
    const ctx = buildQuestionContext(newAnswers);
    const result = getNextFlowQuestion(newAnswers, ctx);
    if (result.done) {
      setCurrentQuestion(null);
      setQIndex(-2);
      setConvoComplete(true);
      setAnswers(normalizeTripAnswers(newAnswers, ctx));
    } else {
      setCurrentQuestion(result);
      setQIndex(0);
      if (result.type === "multiselect") {
        setPrefDraft(Array.isArray(newAnswers[result.id]) ? newAnswers[result.id] : []);
        setPrefSkipReady(false);
      }
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
    };
  }

  useEffect(() => {
    if (currentQuestion?.type !== "multiselect") return;
    setPrefSkipReady(false);
    const t = setTimeout(() => setPrefSkipReady(true), 3000);
    return () => clearTimeout(t);
  }, [currentQuestion?.id, currentQuestion?.type]);

  useEffect(() => {
    if (view !== "app" || generated || convoComplete || qIndex !== -1) return;
    if (!origin?.trim() || !dest?.trim()) return;
    loadNextQuestion({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, origin, dest, generated, convoComplete, qIndex]);

  function getStepMessage() {
    if (qIndex === -2) {
      const completeMsg = getFlowCompleteMessage(answers);
      if (completeMsg) return completeMsg;
      return "Got it. Ready to generate your trip plan?";
    }
    if (currentQuestion) return currentQuestion.ask;
    return null;
  }

  function submitAnswer(value, extraFields = {}) {
    if (!currentQuestion) return;
    const ctx = buildQuestionContext({ ...answers, ...extraFields, [currentQuestion.id]: value });
    const na = normalizeTripAnswers(
      { ...answers, ...extraFields, [currentQuestion.id]: value },
      ctx,
    );

    setAnswers(na);
    setQuestionHistory(h => [...h, { question: currentQuestion, answer: value }]);
    loadNextQuestion(na);
    if (currentQuestion.id === "vehicle" && originRef.current?.value && destRef.current?.value) {
      fetchDirections(na.vehicle);
    }
    if (currentQuestion.id === "fuel_type" && originRef.current?.value && destRef.current?.value) {
      fetchDirections(getEffectiveVehicle(na));
    }
    if (currentQuestion.id === "preferences" && originRef.current?.value && destRef.current?.value && na.vehicle) {
      fetchDirections(na.vehicle);
    }
  }

  function pickAnswer(value, extraFields) {
    if (stepAnim) return;
    setEnterAnim(false);
    setStepAnim({ answer: typeof value === "string" ? value : "selected", phase: "flash" });
    if (stepAnimTimer.current) clearTimeout(stepAnimTimer.current);
    stepAnimTimer.current = setTimeout(() => {
      setStepAnim(prev => prev ? { ...prev, phase: "exit" } : null);
      stepAnimTimer.current = setTimeout(() => {
        submitAnswer(value, extraFields);
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

  useEffect(() => {
    if (!helpMenuOpen) return;
    const onPointerDown = (e) => {
      if (helpWrapRef.current?.contains(e.target)) return;
      setHelpMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [helpMenuOpen]);

  function addFuelStopToTrip(roadStop) {
    setRoadStops(prev => [...prev, roadStop]);
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
      fetchDirections(getEffectiveVehicle(answers));
    }

    try {
      const normalizedAnswers = normalizeTripAnswers(answers, buildQuestionContext(answers));
      const data = await generateTripPlan({
          origin: tripOrigin,
          destination: tripDest,
          answers: {
            ...normalizedAnswers,
            fuel: inferFuelType(normalizedAnswers, normalizedAnswers.preferences || [], normalizedAnswers),
          },
          routeInfo: {
            ...routeInfo,
            origin: tripOrigin,
            destination: tripDest,
            scenic: isScenicRoute(answers),
          },
          legs: tripLegs.length > 0 ? tripLegs : undefined,
          model: "claude-sonnet-4-20250514",
        });
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
    setCurrentQuestion(null); setQuestionHistory([]);
    setConvoComplete(false); setGenerated(false); setStops([]); setTripTips([]); setRoadStops([]); setSelectedLodging([]); setStopCategory("all");
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
    if (last.question.id === "travelers") {
      delete newAnswers.special_needs;
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
    if (last.question.type === "multiselect") {
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
        heroOriginError={heroOriginError}
        heroDestError={heroDestError}
        heroLaunching={heroLaunching}
        launchDisabled={!heroOrigin.trim() || !heroDest.trim() || !isLoaded || heroLaunching}
        heroSearchHover={heroSearchHover}
        heroOriginRef={heroOriginRef}
        heroDestRef={heroDestRef}
        onThemeToggle={toggleTheme}
        onLogin={() => setView("app")}
        onSignup={() => setView("app")}
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
            directions={tripLegs.length === 0 ? directionsResult : null}
            routeInfo={routeInfo}
            answers={answers}
            onMapReady={() => setMapReady(true)}
            onMapStyleOpenChange={setMapStyleOpen}
            onMapStyleChange={setMapStyle}
          />

          <div className={`float-card ${theme} ${cardCollapsed ? "collapsed" : ""}${helpMenuOpen ? " help-open" : ""}`}>
            <div className="float-card-header" onClick={() => setCardCollapsed(c => !c)}>
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
                      arriveByDate={arriveByDate}
                      originRef={originRef}
                      destRef={destRef}
                      convoEndRef={convoEndRef}
                      stopsEndRef={stopsEndRef}
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
                      onAddFuelStop={addFuelStopToTrip}
                      onRemoveRoadStop={removeRoadStop}
                      onLodgingSelect={addLodgingSelection}
                      selectedLodging={selectedLodging}
                      onStopCategoryChange={setStopCategory}
                      onSwapRoute={swapRouteCities}
                      onFetchDirections={fetchDirections}
                      onSetOrigin={setOrigin}
                      onSetDest={setDest}
                      onSetTimingMode={setTimingMode}
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
