/** Route recalculation for itinerary waypoints — Google Directions & HERE truck. */
import { fetchTruckRoute, buildTruckRoutingPayload } from "./truckRoutingApi.js";
import { shouldUseTruckRouting } from "./truckRoutingApi.js";
import { isScenicRoute, hasPref, isTruckVehicle, isRvVehicle } from "./vehicles.js";
import { isTowingSelected } from "./tripAccommodations.js";
import { getIncludedStops, routingPointsFromWaypoints } from "./itineraryWaypoints.js";
import {
  buildRouteSignature,
  getCachedDirections,
  setCachedDirections,
  buildDirectionsCacheEntry,
} from "./directionsCache.js";

export function buildGoogleRouteRequest({
  origin,
  destination,
  waypoints = [],
  answers = {},
  timingMode,
  arriveByDate,
  vehicle = "Car",
}) {
  const routeRequest = {
    origin,
    destination,
    travelMode: window.google.maps.TravelMode.DRIVING,
  };

  const via = Array.isArray(waypoints) && waypoints[0]?.kind
    ? getIncludedStops(waypoints).map(w => (
      w.lat != null && w.lng != null ? { lat: w.lat, lng: w.lng } : (w.city || w.title)
    ))
    : waypoints;
  if (via.length) {
    routeRequest.waypoints = via.map(p => (
      typeof p === "object" && p.lat != null
        ? { location: { lat: p.lat, lng: p.lng }, stopover: true }
        : { location: String(p), stopover: true }
    ));
    routeRequest.optimizeWaypoints = false;
  }

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

  const scenic = isScenicRoute(answers);
  if (isTruckVehicle(vehicle) || isRvVehicle(vehicle)) {
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

  return routeRequest;
}

export function extractRouteLegsFromDirections(route) {
  if (!route?.legs?.length) return [];
  return route.legs.map(leg => ({
    duration: leg.duration?.text || "",
    miles: leg.distance?.text || "",
    durationSeconds: leg.duration?.value,
    distanceMeters: leg.distance?.value,
    start: leg.start_location,
    end: leg.end_location,
  }));
}

export function requestGoogleDirections(routeRequest) {
  return new Promise((resolve) => {
    const service = new window.google.maps.DirectionsService();
    service.route(routeRequest, (result, status) => {
      resolve({ result, status, ok: status === "OK" });
    });
  });
}

export async function fetchItineraryRoute({
  origin,
  destination,
  waypoints,
  answers = {},
  timingMode,
  arriveByDate,
  vehicle,
  signal,
}) {
  const effectiveVehicle = vehicle || answers.vehicle || "Car";

  if (shouldUseTruckRouting({ ...answers, vehicle: effectiveVehicle })) {
    const via = getIncludedStops(waypoints).map(w => (
      w.lat != null && w.lng != null ? { lat: w.lat, lng: w.lng } : (w.city || w.title)
    ));
    const data = await fetchTruckRoute(origin, destination, { ...answers, vehicle: effectiveVehicle }, {
      signal,
      via,
    });
    const legs = (data.sectionSummaries || []).map(s => ({
      duration: s.duration || "",
      miles: s.distance || "",
    }));
    return {
      ok: true,
      provider: "here",
      routeLegs: legs,
      routeInfo: {
        distance: data.distance,
        duration: data.duration,
        routePoints: data.routePoints || [],
        routeLegs: legs,
      },
      routePoints: data.routePoints || [],
      truckData: data,
      directionsResult: null,
    };
  }

  if (!window.google?.maps) return { ok: false, error: "Map not ready" };

  const signature = buildRouteSignature({ origin, destination, waypoints });
  const cached = getCachedDirections(signature);
  if (cached) {
    return {
      ok: true,
      provider: "google",
      directionsResult: cached.directionsResult,
      routePoints: cached.routePoints,
      routeLegs: cached.routeLegs,
      routeInfo: cached.routeInfo,
      fromCache: true,
    };
  }

  const routeRequest = buildGoogleRouteRequest({
    origin,
    destination,
    waypoints,
    answers,
    timingMode,
    arriveByDate,
    vehicle: effectiveVehicle,
  });

  const { result, ok, status } = await requestGoogleDirections(routeRequest);
  if (!ok) {
    return { ok: false, error: status || "Route failed" };
  }

  const route = result.routes[0];
  const cacheEntry = buildDirectionsCacheEntry(result, {
    originVal: origin,
    destVal: destination,
  });
  setCachedDirections(signature, cacheEntry);

  return {
    ok: true,
    provider: "google",
    directionsResult: cacheEntry.directionsResult,
    routePoints: cacheEntry.routePoints,
    routeLegs: cacheEntry.routeLegs,
    routeInfo: cacheEntry.routeInfo,
  };
}
