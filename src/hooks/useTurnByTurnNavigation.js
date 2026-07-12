import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  parseDirectionsSteps,
  buildPolylineSteps,
  buildRoutePolyline,
  simplifyNavigationInstruction,
  simplifyThenPreview,
} from "../lib/navigationSteps.js";
import {
  closestPointOnPolyline,
  remainingPolylineMeters,
  haversineMeters,
  formatDistanceShort,
  formatDurationShort,
  bearingDegrees,
} from "../lib/navigationGeometry.js";

const OFF_ROUTE_THRESHOLD_M = 500;
const OFF_ROUTE_DURATION_MS = 10_000;
const STOP_ARRIVAL_THRESHOLD_M = 200;
const STEP_ADVANCE_THRESHOLD_M = 35;
const NAV_FOLLOW_ZOOM = 15;
const GPS_OPTIONS = { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 };

function normalizeWaypoint(w) {
  if (!w || w.lat == null || w.lng == null) return null;
  return {
    id: w.id,
    title: w.title || w.city || "Stop",
    lat: w.lat,
    lng: w.lng,
    kind: w.kind,
    role: w.role,
  };
}

function findCurrentStepIndex(steps, position) {
  if (!steps.length || !position) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const target = step.end || step.start;
    if (!target) continue;
    const d = haversineMeters(position.lat, position.lng, target.lat, target.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  for (let i = 0; i < steps.length - 1; i++) {
    const end = steps[i].end;
    if (!end) continue;
    const d = haversineMeters(position.lat, position.lng, end.lat, end.lng);
    if (d < STEP_ADVANCE_THRESHOLD_M) return Math.min(i + 1, steps.length - 1);
  }
  return bestIdx;
}

function distanceToStepEndMeters(step, position) {
  if (!step || !position) return 0;
  const end = step.end || step.start;
  if (!end) return step.distanceMeters || 0;
  return haversineMeters(position.lat, position.lng, end.lat, end.lng);
}

/**
 * Live turn-by-turn navigation state from GPS + DirectionsResult / polyline.
 */
export function useTurnByTurnNavigation({
  active = false,
  directionsResult = null,
  routePoints = [],
  itineraryWaypoints = [],
  destination = "",
  mapRef = null,
  onToast = null,
  followMap = true,
  routePointsForOverview = [],
}) {
  const [userPosition, setUserPosition] = useState(null);
  const [heading, setHeading] = useState(0);
  const [speedMps, setSpeedMps] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [offRoute, setOffRoute] = useState(false);
  const [passedStopIds, setPassedStopIds] = useState(() => new Set());
  const [arrivingStop, setArrivingStop] = useState(null);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [mapViewMode, setMapViewMode] = useState("follow");

  const offRouteSinceRef = useRef(null);
  const announcedArrivalRef = useRef(new Set());
  const watchIdRef = useRef(null);

  const steps = useMemo(() => {
    const parsed = parseDirectionsSteps(directionsResult);
    if (parsed.length) return parsed;
    return buildPolylineSteps(routePoints);
  }, [directionsResult, routePoints]);

  const polyline = useMemo(
    () => buildRoutePolyline(directionsResult, routePoints),
    [directionsResult, routePoints],
  );

  const tripStops = useMemo(() => {
    const stops = (itineraryWaypoints || [])
      .filter((w) => w.kind === "stop" && w.included !== false)
      .map(normalizeWaypoint)
      .filter(Boolean);
    const destWp = itineraryWaypoints?.find((w) => w.kind === "destination");
    const destPoint = destWp ? normalizeWaypoint(destWp) : null;
    return { stops, destPoint };
  }, [itineraryWaypoints]);

  const legTargets = useMemo(() => {
    const targets = [...tripStops.stops];
    if (tripStops.destPoint) targets.push(tripStops.destPoint);
    return targets;
  }, [tripStops]);

  const currentStepIndex = useMemo(() => {
    if (!userPosition || !steps.length) return 0;
    return findCurrentStepIndex(steps, userPosition);
  }, [userPosition, steps]);

  const currentStep = steps[currentStepIndex] || null;
  const nextStep = steps[currentStepIndex + 1] || null;

  const closestOnRoute = useMemo(() => {
    if (!userPosition || polyline.length < 2) return null;
    return closestPointOnPolyline(userPosition, polyline);
  }, [userPosition, polyline]);

  const distanceToTurnMeters = useMemo(() => {
    if (!currentStep || !userPosition) return currentStep?.distanceMeters ?? 0;
    return distanceToStepEndMeters(currentStep, userPosition);
  }, [currentStep, userPosition]);

  const remainingRouteMeters = useMemo(() => {
    if (!closestOnRoute) return 0;
    return remainingPolylineMeters(polyline, closestOnRoute);
  }, [closestOnRoute, polyline]);

  const nextLegTarget = legTargets[currentLegIndex] || legTargets[legTargets.length - 1] || null;

  const distanceToNextStopMeters = useMemo(() => {
    if (!userPosition || !nextLegTarget) return remainingRouteMeters;
    return haversineMeters(userPosition.lat, userPosition.lng, nextLegTarget.lat, nextLegTarget.lng);
  }, [userPosition, nextLegTarget, remainingRouteMeters]);

  const avgSpeedMps = useMemo(() => {
    if (speedMps != null && speedMps > 1) return speedMps;
    return 22;
  }, [speedMps]);

  const etaNextStopSeconds = distanceToNextStopMeters / avgSpeedMps;
  const etaDestinationSeconds = remainingRouteMeters / avgSpeedMps;

  const navDisplay = useMemo(() => {
    const rawInstruction = currentStep?.instruction || "Follow route";
    const road = currentStep?.roadName || "";
    const instruction = simplifyNavigationInstruction(rawInstruction, road);
    const nextRaw = nextStep?.instruction || null;
    const nextRoad = nextStep?.roadName || "";
    const nextPreview = nextRaw
      ? simplifyThenPreview(nextRaw, nextRoad, nextStep?.maneuver)
      : null;

    const includedStops = (itineraryWaypoints || []).filter(
      (w) => w.kind === "stop" && w.included !== false,
    ).length;
    const showDualEta = includedStops > 0 && legTargets.length > 1;

    return {
      instruction,
      roadName: road,
      distanceToTurn: formatDistanceShort(distanceToTurnMeters),
      distanceToTurnMeters,
      nextInstruction: nextPreview,
      nextRoadName: nextRoad,
      maneuver: currentStep?.maneuver || null,
      etaNextStop: formatDurationShort(etaNextStopSeconds),
      etaDestination: formatDurationShort(etaDestinationSeconds),
      distanceRemaining: formatDistanceShort(remainingRouteMeters),
      distanceToNextStop: formatDistanceShort(distanceToNextStopMeters),
      currentLegIndex,
      totalLegs: legTargets.length,
      nextStopName: nextLegTarget?.title || destination?.split(",")[0]?.trim() || "Destination",
      speedMph: speedMps != null && speedMps > 0 ? Math.round(speedMps * 2.237) : null,
      stepIndex: currentStepIndex,
      stepCount: steps.length,
      offRoute,
      gpsError,
      hasGps: Boolean(userPosition),
      showDualEta,
    };
  }, [
    currentStep, nextStep, distanceToTurnMeters, etaNextStopSeconds, etaDestinationSeconds,
    remainingRouteMeters, distanceToNextStopMeters, currentLegIndex, legTargets.length,
    nextLegTarget, destination, speedMps, currentStepIndex, steps.length, offRoute, gpsError, userPosition,
    itineraryWaypoints,
  ]);

  const snapToFollowView = useCallback((position) => {
    if (!mapRef?.current || !position) return;
    mapRef.current.panTo({ lat: position.lat, lng: position.lng });
    mapRef.current.setZoom(NAV_FOLLOW_ZOOM);
  }, [mapRef]);

  const showRouteOverview = useCallback(() => {
    setMapViewMode("overview");
    const path = routePointsForOverview?.length > 1 ? routePointsForOverview : polyline;
    if (!mapRef?.current || !window.google?.maps || path.length < 2) return;
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((point) => {
      if (point?.lat != null && point?.lng != null) bounds.extend(point);
    });
    mapRef.current.fitBounds(bounds, { padding: 72 });
    const listener = window.google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
      const zoom = mapRef.current.getZoom?.();
      if (typeof zoom === "number" && zoom > 12) mapRef.current.setZoom(12);
    });
    return () => {
      if (listener) window.google.maps.event.removeListener(listener);
    };
  }, [mapRef, routePointsForOverview, polyline]);

  const resumeFollowing = useCallback(() => {
    setMapViewMode("follow");
    const pos = userPosition || polyline[0];
    if (pos) snapToFollowView(pos);
  }, [userPosition, polyline, snapToFollowView]);

  useEffect(() => {
    if (!active) {
      setUserPosition(null);
      setGpsError(null);
      setOffRoute(false);
      setMapViewMode("follow");
      offRouteSinceRef.current = null;
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return undefined;
    }

    if (!navigator.geolocation) {
      setGpsError("Location not supported in this browser");
      return undefined;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPosition({ lat, lng });
        setSpeedMps(pos.coords.speed);
        setGpsError(null);
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading) && pos.coords.speed > 1) {
          setHeading(pos.coords.heading);
        }
      },
      (err) => {
        setGpsError(err.code === 1 ? "Enable location to navigate" : "GPS signal unavailable");
      },
      GPS_OPTIONS,
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active]);

  useEffect(() => {
    if (!active || mapViewMode !== "follow" || !followMap || !mapRef?.current) return;
    const pos = userPosition || polyline[0];
    if (pos) snapToFollowView(pos);
  }, [active, mapViewMode, followMap, userPosition, polyline, snapToFollowView, mapRef]);

  useEffect(() => {
    if (!userPosition || !polyline.length || !active) {
      setOffRoute(false);
      offRouteSinceRef.current = null;
      return;
    }
    const { distanceMeters } = closestPointOnPolyline(userPosition, polyline);
    if (distanceMeters > OFF_ROUTE_THRESHOLD_M) {
      if (!offRouteSinceRef.current) offRouteSinceRef.current = Date.now();
      if (Date.now() - offRouteSinceRef.current >= OFF_ROUTE_DURATION_MS) {
        setOffRoute(true);
      }
    } else {
      offRouteSinceRef.current = null;
      setOffRoute(false);
    }
  }, [userPosition, polyline, active]);

  useEffect(() => {
    if (!active || !userPosition || !legTargets.length) return;

    for (let i = currentLegIndex; i < legTargets.length; i++) {
      const stop = legTargets[i];
      const dist = haversineMeters(userPosition.lat, userPosition.lng, stop.lat, stop.lng);

      if (dist <= STOP_ARRIVAL_THRESHOLD_M && !announcedArrivalRef.current.has(stop.id)) {
        announcedArrivalRef.current.add(stop.id);
        setArrivingStop(stop);
        onToast?.(`Arriving at ${stop.title}`, true);
      }

      if (dist > STOP_ARRIVAL_THRESHOLD_M * 1.5 && announcedArrivalRef.current.has(stop.id)) {
        setPassedStopIds((prev) => new Set([...prev, stop.id]));
        if (i === currentLegIndex && i < legTargets.length - 1) {
          setCurrentLegIndex(i + 1);
          setArrivingStop(null);
        }
      }
    }
  }, [active, userPosition, legTargets, currentLegIndex, onToast]);

  useEffect(() => {
    if (!userPosition || !polyline.length) return;
    const close = closestPointOnPolyline(userPosition, polyline);
    const segEnd = polyline[Math.min(close.segmentIndex + 1, polyline.length - 1)];
    if (segEnd && (speedMps == null || speedMps < 1)) {
      setHeading(bearingDegrees(userPosition, segEnd));
    }
  }, [userPosition, polyline, speedMps]);

  const dismissArrival = useCallback(() => setArrivingStop(null), []);

  const resetNavigation = useCallback(() => {
    setPassedStopIds(new Set());
    setCurrentLegIndex(0);
    setArrivingStop(null);
    announcedArrivalRef.current = new Set();
    offRouteSinceRef.current = null;
    setOffRoute(false);
    setMapViewMode("follow");
  }, []);

  return {
    userPosition,
    heading,
    steps,
    polyline,
    navDisplay,
    arrivingStop,
    passedStopIds,
    legTargets,
    dismissArrival,
    resetNavigation,
    carPosition: userPosition || (polyline[0] ?? null),
    carHeading: heading,
    mapViewMode,
    showRouteOverview,
    resumeFollowing,
  };
}
