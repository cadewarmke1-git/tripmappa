/** Live location staleness, breadcrumbs, and display helpers. */

const STALE_MS = 5 * 60 * 1000;

export function isLocationStale(lastUpdated) {
  if (!lastUpdated) return true;
  return Date.now() - new Date(lastUpdated).getTime() > STALE_MS;
}

export function formatLastSeen(lastUpdated) {
  if (!lastUpdated) return "Last seen unknown";
  const mins = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000);
  if (mins < 1) return "Last seen just now";
  if (mins === 1) return "Last seen 1 minute ago";
  return `Last seen ${mins} minutes ago`;
}

export function getNextOvernightStop(stops = []) {
  if (!Array.isArray(stops) || !stops.length) return null;
  return stops.find(s => s?.city) || stops[0];
}

export function getRoutePathFromLiveTrip(liveTrip) {
  const points = liveTrip?.routeInfo?.routePoints || liveTrip?.route_info?.routePoints;
  if (Array.isArray(points) && points.length > 1) return points;
  return [];
}

export function extractDestinationCity(destination) {
  if (!destination) return "your destination";
  return destination.split(",")[0]?.trim() || destination;
}

export function normalizeConvoyMembers(members = []) {
  return members.map(m => ({
    id: m.id,
    name: m.name,
    color: m.color,
    latitude: m.latitude,
    longitude: m.longitude,
    speedMph: m.speed_mph ?? m.speedMph,
    distanceToDest: m.distance_to_dest ?? m.distanceToDest,
    lastUpdated: m.last_updated ?? m.lastUpdated,
  }));
}

export function breadcrumbsToPath(breadcrumbs = []) {
  return breadcrumbs
    .filter(p => p?.lat != null && p?.lng != null)
    .map(p => ({ lat: p.lat, lng: p.lng }));
}
