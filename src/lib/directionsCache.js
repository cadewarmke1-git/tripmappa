/** Session cache for Google DirectionsResult — keyed by origin, destination, and stop waypoints. */
import { parseCityStateFromFormattedAddress } from "./routeCities.js";

const MAX_ENTRIES = 16;
const store = new Map();

function latLngPoint(p) {
  if (!p) return null;
  const lat = typeof p.lat === "function" ? p.lat() : p.lat;
  const lng = typeof p.lng === "function" ? p.lng() : p.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Normalize a waypoint into a stable signature segment. */
export function normalizeWaypointForSignature(wp) {
  if (!wp) return null;
  if (typeof wp === "string") {
    const s = wp.trim().toLowerCase();
    return s || null;
  }
  if (wp.kind === "origin" || wp.kind === "destination" || wp.included === false) return null;
  const coords = latLngPoint(wp) || latLngPoint(wp.location);
  if (coords) return `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
  const label = wp.city || wp.title || wp.location;
  if (label) return String(label).trim().toLowerCase();
  return null;
}

/** Stable route key: origin + destination + ordered stop waypoints. */
export function buildRouteSignature({ origin, destination, waypoints = [] } = {}) {
  const o = String(origin || "").trim().toLowerCase();
  const d = String(destination || "").trim().toLowerCase();
  const stops = (waypoints || []).map(normalizeWaypointForSignature).filter(Boolean);
  return `${o}|${d}|${stops.join(";")}`;
}

export function getCachedDirections(signature) {
  if (!signature) return null;
  const entry = store.get(signature);
  if (!entry) return null;
  store.delete(signature);
  store.set(signature, entry);
  return entry;
}

export function setCachedDirections(signature, entry) {
  if (!signature || !entry?.directionsResult) return;
  if (store.has(signature)) store.delete(signature);
  store.set(signature, entry);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}

export function extractRoutePointsFromDirections(result) {
  const route = result?.routes?.[0];
  if (!route) return [];
  if (route.overview_path?.length) {
    return route.overview_path.map(latLngPoint).filter(Boolean);
  }
  const path = [];
  for (const leg of route.legs || []) {
    for (const step of leg.steps || []) {
      for (const p of step.path || []) {
        const pt = latLngPoint(p);
        if (pt) path.push(pt);
      }
    }
  }
  return path;
}

function extractCitiesAlongRoute(route) {
  const citiesAlongRoute = [];
  const seen = new Set();
  for (const leg of route?.legs || []) {
    for (const step of leg.steps || []) {
      if (!step.end_address) continue;
      const cityState = parseCityStateFromFormattedAddress(step.end_address);
      if (cityState && !seen.has(cityState)) {
        seen.add(cityState);
        citiesAlongRoute.push(cityState);
      }
    }
  }
  return citiesAlongRoute.slice(0, 15);
}

function extractRouteLegsFromDirections(route) {
  if (!route?.legs?.length) return [];
  return route.legs.map((leg) => ({
    duration: leg.duration?.text || "",
    miles: leg.distance?.text || "",
    durationSeconds: leg.duration?.value,
    distanceMeters: leg.distance?.value,
    start: leg.start_location,
    end: leg.end_location,
  }));
}

function formatMi(meters) {
  const miles = meters / 1609.344;
  return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
}

function formatDur(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

/** Build cache entry from a Google DirectionsResult. */
export function buildDirectionsCacheEntry(result, { originVal, destVal, routeInfoExtras = {} } = {}) {
  const route = result?.routes?.[0];
  if (!route?.legs?.length) return null;

  const leg = route.legs[0];
  const totalDistance = route.legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
  const totalDuration = route.legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
  const routePoints = extractRoutePointsFromDirections(result);
  const routeLegs = extractRouteLegsFromDirections(route);
  const start = leg.start_location;
  const end = leg.end_location;

  const routeInfo = {
    distance: route.legs.length > 1
      ? (totalDistance ? formatMi(totalDistance) : leg.distance?.text)
      : leg.distance?.text,
    duration: route.legs.length > 1
      ? (totalDuration ? formatDur(totalDuration) : leg.duration?.text)
      : leg.duration?.text,
    start: leg.start_address?.split(",")[0],
    end: leg.end_address?.split(",")[0],
    origin: originVal,
    destination: destVal,
    originLat: latLngPoint(start)?.lat,
    originLng: latLngPoint(start)?.lng,
    destLat: latLngPoint(end)?.lat,
    destLng: latLngPoint(end)?.lng,
    citiesAlongRoute: extractCitiesAlongRoute(route),
    routePoints,
    routeLegs,
    ...routeInfoExtras,
  };

  return {
    directionsResult: result,
    routeInfo,
    routePoints,
    routeLegs,
    routePath: route.overview_path || routePoints,
  };
}
