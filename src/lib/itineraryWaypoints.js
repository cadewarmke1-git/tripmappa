/** Single source of truth for itinerary order — origin, stops, destination. */
import { buildItineraryDays } from "./itineraryDays.js";
import { buildJourneyTimeline } from "./buildJourneyTimeline.js";
import { isContinuousDrive } from "./driveMode.js";

function cityLabel(full) {
  if (!full) return "";
  return full.split(",")[0].trim();
}

function coordsFrom(routeInfo, which) {
  if (which === "origin") {
    if (routeInfo?.originLat != null) return { lat: routeInfo.originLat, lng: routeInfo.originLng };
  } else if (routeInfo?.destLat != null) {
    return { lat: routeInfo.destLat, lng: routeInfo.destLng };
  }
  return null;
}

export function makeOriginWaypoint(origin, routeInfo) {
  const coords = coordsFrom(routeInfo, "origin");
  return {
    id: "waypoint-origin",
    kind: "origin",
    role: "origin",
    included: true,
    title: cityLabel(origin) || origin,
    city: origin,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    stopData: null,
  };
}

export function makeDestinationWaypoint(dest, routeInfo) {
  const coords = coordsFrom(routeInfo, "dest");
  return {
    id: "waypoint-destination",
    kind: "destination",
    role: "destination",
    included: true,
    title: cityLabel(dest) || dest,
    city: dest,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    stopData: null,
  };
}

function stopToWaypoint(stop, { isOvernight, included = true }) {
  return {
    id: stop.id,
    kind: "stop",
    role: isOvernight ? "overnight" : "road",
    included,
    title: stop.title || stop.name || stop.city || "Stop",
    city: stop.city || stop.location,
    lat: stop.lat ?? stop.stopData?.lat ?? null,
    lng: stop.lng ?? stop.stopData?.lng ?? null,
    category: stop.category,
    description: stop.description,
    rating: stop.rating,
    photoUrl: stop.photoUrl,
    type: stop.type,
    action: stop.action,
    stopData: stop.stopData || stop,
    nearbyRestaurants: stop.nearbyRestaurants,
  };
}

/** Build initial waypoint array from a generated trip. */
export function buildInitialItineraryWaypoints({
  origin,
  dest,
  routeInfo,
  stops = [],
  roadStops = [],
  answers = {},
  departureTime = null,
  optionalStopCards = [],
  activitiesByCity = {},
  restaurantsByCity = {},
  recommendations = [],
}) {
  const continuousDrive = isContinuousDrive(answers);
  const days = buildItineraryDays({
    origin,
    dest,
    stops,
    roadStops,
    routeInfo,
    departureTime,
    answers,
    optionalStopCards,
    activitiesByCity,
    restaurantsByCity,
    recommendations,
  });
  const rows = buildJourneyTimeline({ days, dest, departureTime, continuousDrive });

  const waypoints = [makeOriginWaypoint(origin, routeInfo)];
  for (const row of rows) {
    if (row.kind !== "stop") continue;
    const roadEntry = roadStops.find(rs => (rs.id || `road-${rs.name}`) === row.stop.id
      || rs.id === row.stop.id);
    const included = row.isOvernight
      || roadEntry?.userAdded !== false
      || !roadEntry
      || roadEntry.userAdded === true;
    waypoints.push(stopToWaypoint(row.stop, { isOvernight: row.isOvernight, included: included !== false }));
  }
  waypoints.push(makeDestinationWaypoint(dest, routeInfo));
  return waypoints;
}

export function getIncludedStops(waypoints = []) {
  return waypoints.filter(w => w.kind === "stop" && w.included);
}

export function getSortableStopIds(waypoints = []) {
  return getIncludedStops(waypoints).map(w => w.id);
}

function arrayMove(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Reorder included middle stops; origin and destination stay fixed. */
export function reorderItineraryWaypoints(waypoints, activeId, overId) {
  if (!activeId || !overId || activeId === overId) return waypoints;
  const origin = waypoints.find(w => w.kind === "origin");
  const destination = waypoints.find(w => w.kind === "destination");
  const included = getIncludedStops(waypoints);
  const excluded = waypoints.filter(w => w.kind === "stop" && !w.included);
  const from = included.findIndex(w => w.id === activeId);
  const to = included.findIndex(w => w.id === overId);
  if (from < 0 || to < 0) return waypoints;
  const reordered = arrayMove(included, from, to);
  return [origin, ...reordered, ...excluded, destination].filter(Boolean);
}

export function setWaypointIncluded(waypoints, id, included) {
  return waypoints.map(w => (w.id === id && w.kind === "stop" ? { ...w, included } : w));
}

export function addWaypointBeforeDestination(waypoints, stop) {
  const destination = waypoints.find(w => w.kind === "destination");
  const rest = waypoints.filter(w => w.kind !== "destination");
  const wp = stopToWaypoint(stop, { isOvernight: false, included: true });
  wp.stopData = { ...wp.stopData, userAdded: true };
  return [...rest, wp, destination].filter(Boolean);
}

export function routingPointsFromWaypoints(waypoints = []) {
  return getIncludedStops(waypoints).map(w => {
    if (w.lat != null && w.lng != null) return { lat: w.lat, lng: w.lng };
    return w.city || w.title;
  });
}

export function waypointsToStopsAndRoad(waypoints = []) {
  const stops = [];
  const roadStops = [];
  for (const w of waypoints) {
    if (w.kind !== "stop") continue;
    const data = w.stopData || w;
    if (w.role === "overnight" && w.included) {
      stops.push(data.city ? data : { ...data, city: w.city });
    } else if (w.role === "road") {
      roadStops.push({ ...data, userAdded: Boolean(w.included) });
    }
  }
  return { stops, roadStops };
}

export function countIncludedStops(waypoints = []) {
  return getIncludedStops(waypoints).length;
}
