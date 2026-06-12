import { useState, useRef, useCallback, useMemo } from "react";
import {
  buildInitialItineraryWaypoints,
  reorderItineraryWaypoints,
  setWaypointIncluded,
  removeWaypoint,
  addWaypointBeforeDestination,
  waypointsToStopsAndRoad,
} from "../lib/itineraryWaypoints.js";
import { waypointsToNumberedMarkers } from "../lib/mapMarkers.js";
import { fetchItineraryRoute } from "../lib/itineraryRouting.js";
import { buildAnchorPointsFromWaypoints, sliceRouteLegPath } from "../lib/routeLegPaths.js";
import { getEffectiveVehicle } from "../lib/vehicles.js";

const RECALC_DEBOUNCE_MS = 400;

export function useItinerarySync({
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
  toast_,
}) {
  const [itineraryWaypoints, setItineraryWaypoints] = useState([]);
  const [routeLegs, setRouteLegs] = useState([]);
  const [highlightedLegIndex, setHighlightedLegIndex] = useState(null);
  const [expandedTimelineStopId, setExpandedTimelineStopId] = useState(null);
  const [routeFocusMode, setRouteFocusMode] = useState(false);

  const revertRef = useRef(null);
  const waypointsRef = useRef([]);
  const recalcTimerRef = useRef(null);
  const recalcAbortRef = useRef(null);

  waypointsRef.current = itineraryWaypoints;

  const initFromTrip = useCallback((tripCtx) => {
    const waypoints = buildInitialItineraryWaypoints({
      origin: tripCtx.origin,
      dest: tripCtx.dest,
      routeInfo: tripCtx.routeInfo,
      stops: tripCtx.stops,
      roadStops: tripCtx.roadStops,
      answers: tripCtx.answers,
      departureTime: tripCtx.departureTime,
      optionalStopCards: tripCtx.optionalStopCards,
      activitiesByCity: tripCtx.activitiesByCity,
      restaurantsByCity: tripCtx.restaurantsByCity,
      recommendations: tripCtx.recommendations,
    });
    setItineraryWaypoints(waypoints);
    setRouteLegs(tripCtx.routeInfo?.routeLegs || []);
    setMapMarkers(waypointsToNumberedMarkers(waypoints, tripCtx.answers));
    revertRef.current = waypoints;
    return waypoints;
  }, [setMapMarkers]);

  const fitMapToRoute = useCallback((routePoints, waypoints) => {
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let has = false;
    (routePoints || []).forEach(p => { bounds.extend(p); has = true; });
    waypoints.forEach(w => {
      if (w.lat != null && w.lng != null) { bounds.extend({ lat: w.lat, lng: w.lng }); has = true; }
    });
    if (has) mapRef.current.fitBounds(bounds, { padding: 72 });
  }, [mapRef]);

  const recalculateRoute = useCallback(async (waypoints) => {
    recalcAbortRef.current?.abort();
    const controller = new AbortController();
    recalcAbortRef.current = controller;

    const originWp = waypoints.find(w => w.kind === "origin");
    const destWp = waypoints.find(w => w.kind === "destination");
    const originVal = originWp?.city || origin;
    const destVal = destWp?.city || dest;

    try {
      const result = await fetchItineraryRoute({
        origin: originVal,
        destination: destVal,
        waypoints,
        answers,
        timingMode,
        arriveByDate,
        vehicle: getEffectiveVehicle(answers),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return false;
      if (!result.ok) return false;

      const legs = result.routeLegs || result.routeInfo?.routeLegs || [];
      setRouteLegs(legs);
      setRouteInfo(prev => ({
        ...(prev || {}),
        distance: result.routeInfo?.distance || prev?.distance,
        duration: result.routeInfo?.duration || prev?.duration,
        routePoints: result.routePoints || result.routeInfo?.routePoints || prev?.routePoints,
        routeLegs: legs,
      }));

      if (result.provider === "here") {
        setTruckRoutePath(result.routePoints);
        setRoutePath(result.routePoints);
        setDirectionsResult(null);
      } else {
        setDirectionsResult(result.directionsResult);
        setRoutePath(result.routePoints);
        setTruckRoutePath(null);
      }

      const { stops: nextStops, roadStops: nextRoad } = waypointsToStopsAndRoad(waypoints);
      setStops(nextStops);
      setRoadStops(nextRoad);
      setMapMarkers(waypointsToNumberedMarkers(waypoints, answers));
      fitMapToRoute(result.routePoints, waypoints);
      revertRef.current = waypoints;
      return true;
    } catch (err) {
      if (err.name === "AbortError") return false;
      return false;
    }
  }, [
    origin, dest, answers, timingMode, arriveByDate,
    setRouteInfo, setDirectionsResult, setRoutePath, setTruckRoutePath,
    setStops, setRoadStops, setMapMarkers, fitMapToRoute,
  ]);

  const scheduleRecalc = useCallback((nextWaypoints) => {
    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcTimerRef.current = setTimeout(async () => {
      const snapshot = revertRef.current;
      const ok = await recalculateRoute(nextWaypoints);
      if (!ok && snapshot) {
        setItineraryWaypoints(snapshot);
        setMapMarkers(waypointsToNumberedMarkers(snapshot, answers));
        toast_?.("Couldn't update route — restored your previous order", { isError: true });
      }
    }, RECALC_DEBOUNCE_MS);
  }, [recalculateRoute, answers, setMapMarkers, toast_]);

  const commitWaypoints = useCallback((nextWaypoints, { recalc = true } = {}) => {
    if (waypointsRef.current.length) {
      revertRef.current = waypointsRef.current.map(w => ({ ...w }));
    }
    waypointsRef.current = nextWaypoints;
    setItineraryWaypoints(nextWaypoints);
    setMapMarkers(waypointsToNumberedMarkers(nextWaypoints, answers));
    const { stops: nextStops, roadStops: nextRoad } = waypointsToStopsAndRoad(nextWaypoints);
    setStops(nextStops);
    setRoadStops(nextRoad);
    if (recalc) scheduleRecalc(nextWaypoints);
  }, [answers, scheduleRecalc, setMapMarkers, setStops, setRoadStops]);

  const handleReorder = useCallback((activeId, overId) => {
    const next = reorderItineraryWaypoints(waypointsRef.current, activeId, overId);
    commitWaypoints(next);
  }, [commitWaypoints]);

  const handleToggleIncluded = useCallback((stopId, included) => {
    const next = setWaypointIncluded(waypointsRef.current, stopId, included);
    commitWaypoints(next);
  }, [commitWaypoints]);

  const handleAddStop = useCallback((stop) => {
    const next = addWaypointBeforeDestination(waypointsRef.current, stop);
    commitWaypoints(next);
  }, [commitWaypoints]);

  const handleRemoveStop = useCallback((stopId) => {
    const wp = waypointsRef.current.find(w => w.id === stopId);
    if (!wp) return;
    const next = wp.stopData?.userAdded
      ? removeWaypoint(waypointsRef.current, stopId)
      : setWaypointIncluded(waypointsRef.current, stopId, false);
    commitWaypoints(next);
  }, [commitWaypoints]);

  const highlightedLegPath = useMemo(() => {
    if (highlightedLegIndex == null || !routeInfo?.routePoints?.length) return [];
    const anchors = buildAnchorPointsFromWaypoints(itineraryWaypoints);
    return sliceRouteLegPath(routeInfo.routePoints, anchors, highlightedLegIndex);
  }, [highlightedLegIndex, routeInfo, itineraryWaypoints]);

  const scrollToStopRef = useRef(null);

  const registerTimelineScroller = useCallback((fn) => {
    scrollToStopRef.current = fn;
  }, []);

  const scrollToTimelineStop = useCallback((stopId) => {
    scrollToStopRef.current?.(stopId);
  }, []);

  const handleMarkerSelect = useCallback((marker) => {
    const id = marker.waypointId || marker.id;
    if (!id) return;
    setExpandedTimelineStopId(id);
    scrollToTimelineStop(id);
  }, [scrollToTimelineStop]);

  const handleNavigateToStop = useCallback((stop) => {
    const id = stop?.id;
    if (!id) return;
    const idx = itineraryWaypoints.findIndex(w => w.id === id);
    const includedBefore = itineraryWaypoints
      .slice(0, idx)
      .filter(w => (w.kind === "stop" && w.included) || w.kind === "origin").length;
    const legIndex = Math.max(0, includedBefore - 1);
    setHighlightedLegIndex(legIndex);
    setExpandedTimelineStopId(id);
    scrollToTimelineStop(id);
    if (stop.lat != null && stop.lng != null && mapRef.current) {
      mapRef.current.panTo({ lat: stop.lat, lng: stop.lng });
      const zoom = mapRef.current.getZoom?.() ?? 8;
      if (zoom < 11) mapRef.current.setZoom(12);
    }
  }, [itineraryWaypoints, mapRef, scrollToTimelineStop]);

  const handleStartNavigation = useCallback(() => {
    setRouteFocusMode(true);
    setHighlightedLegIndex(null);
    fitMapToRoute(routeInfo?.routePoints, itineraryWaypoints);
    return true;
  }, [fitMapToRoute, routeInfo, itineraryWaypoints]);

  const resetItinerary = useCallback(() => {
    setItineraryWaypoints([]);
    setRouteLegs([]);
    setHighlightedLegIndex(null);
    setExpandedTimelineStopId(null);
    setRouteFocusMode(false);
    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcAbortRef.current?.abort();
  }, []);

  return {
    itineraryWaypoints,
    routeLegs,
    highlightedLegIndex,
    highlightedLegPath,
    expandedTimelineStopId,
    setExpandedTimelineStopId,
    routeFocusMode,
    setRouteFocusMode,
    initFromTrip,
    handleReorder,
    handleToggleIncluded,
    handleAddStop,
    handleRemoveStop,
    handleMarkerSelect,
    handleNavigateToStop,
    handleStartNavigation,
    registerTimelineScroller,
    scrollToTimelineStop,
    resetItinerary,
    isWaypointIncluded: (stopId) => {
      const w = itineraryWaypoints.find(wp => wp.id === stopId);
      return w?.included === true;
    },
  };
}
