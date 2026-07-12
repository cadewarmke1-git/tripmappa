import { useMemo, useState, useCallback } from "react";
import {
  buildNextStopContext,
  buildFuelRangeAdvisory,
  findCorridorAlert,
  buildArrivalContext,
} from "../lib/navigationTripContext.js";

/**
 * Trip-aware navigation context — surfaces planned-trip data during live navigation.
 */
export function useNavigationTripContext({
  active = false,
  userPosition = null,
  nextWaypoint = null,
  arrivingStop = null,
  passedStopIds = new Set(),
  answers = {},
  roadStops = [],
  routePoints = [],
  routeInfo = null,
  selectedLodging = [],
  weatherByCity = {},
  restaurantsByCity = {},
  tripTips = [],
  liveTripTips = [],
  tripAlerts = [],
  liveSharingActive = false,
}) {
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => new Set());
  const [fuelDismissed, setFuelDismissed] = useState(false);

  const tripCtx = useMemo(() => ({
    selectedLodging,
    weatherByCity,
    restaurantsByCity,
    answers,
  }), [selectedLodging, weatherByCity, restaurantsByCity, answers]);

  const nextStopContext = useMemo(() => {
    if (!active || !nextWaypoint) return null;
    return buildNextStopContext(nextWaypoint, tripCtx);
  }, [active, nextWaypoint, tripCtx]);

  const fuelAdvisory = useMemo(() => {
    if (!active || fuelDismissed) return null;
    return buildFuelRangeAdvisory({
      userPosition,
      answers,
      roadStops,
      routePoints,
      routeInfo,
      passedStopIds,
    });
  }, [active, fuelDismissed, userPosition, answers, roadStops, routePoints, routeInfo, passedStopIds]);

  const corridorAlert = useMemo(() => {
    if (!active || !userPosition) return null;
    const alert = findCorridorAlert({
      userPosition,
      tripTips,
      liveTripTips,
      tripAlerts,
      weatherByCity,
      routePoints,
      handledIds: dismissedAlertIds,
    });
    if (!alert || dismissedAlertIds.has(alert.id)) return null;
    return alert;
  }, [
    active, userPosition, tripTips, liveTripTips, tripAlerts,
    weatherByCity, routePoints, dismissedAlertIds,
  ]);

  const arrivalContext = useMemo(() => {
    if (!active || !arrivingStop) return null;
    return buildArrivalContext(arrivingStop, tripCtx);
  }, [active, arrivingStop, tripCtx]);

  const dismissCorridorAlert = useCallback((id) => {
    setDismissedAlertIds((prev) => new Set([...prev, id]));
  }, []);

  const dismissFuelAdvisory = useCallback(() => setFuelDismissed(true), []);

  const resetTripContext = useCallback(() => {
    setDismissedAlertIds(new Set());
    setFuelDismissed(false);
  }, []);

  return {
    nextStopContext,
    fuelAdvisory,
    corridorAlert,
    arrivalContext,
    liveSharingActive: active && liveSharingActive,
    dismissCorridorAlert,
    dismissFuelAdvisory,
    resetTripContext,
  };
}
