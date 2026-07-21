/** Route-corridor explore: how far along a loaded route in X drive hours. */

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return 0;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Parse route duration labels like "3 hours 30 mins" / "13 hr" into seconds. */
export function parseRouteDurationSeconds(duration) {
  if (duration == null) return null;
  if (typeof duration === "number" && Number.isFinite(duration)) {
    return duration > 1000 ? duration : duration * 3600;
  }
  const text = String(duration).toLowerCase();
  if (!text.trim()) return null;
  let seconds = 0;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/);
  const minMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min)\b/);
  if (hourMatch) seconds += Number(hourMatch[1]) * 3600;
  if (minMatch) seconds += Number(minMatch[1]) * 60;
  if (seconds > 0) return Math.round(seconds);
  const asNum = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(asNum) && asNum > 0 ? Math.round(asNum * 3600) : null;
}

export function buildRouteDistanceIndex(routePoints = []) {
  const points = (routePoints || []).filter((p) => p?.lat != null && p?.lng != null);
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(cumulative[i - 1] + haversineMeters(points[i - 1], points[i]));
  }
  return { points, cumulative, totalMeters: cumulative[cumulative.length - 1] || 0 };
}

export function nearestRouteIndex(routeIndex, lat, lng) {
  const { points } = routeIndex;
  if (!points.length || lat == null || lng == null) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const d = haversineMeters(points[i], { lat, lng });
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Slice the route corridor reachable in `driveSeconds` from a start position along the route.
 */
export function computeExploreCorridor({
  routePoints = [],
  driveSeconds = 7200,
  totalDurationSeconds = null,
  totalDistanceMeters = null,
  fromLat = null,
  fromLng = null,
} = {}) {
  const index = buildRouteDistanceIndex(routePoints);
  if (index.points.length < 2 || !driveSeconds || driveSeconds <= 0) {
    return { path: [], endMeters: 0, startMeters: 0, startIndex: 0, endIndex: 0 };
  }

  const startIndex = (fromLat != null && fromLng != null)
    ? nearestRouteIndex(index, fromLat, fromLng)
    : 0;
  const startMeters = index.cumulative[startIndex] || 0;

  const totalMeters = totalDistanceMeters > 0 ? totalDistanceMeters : index.totalMeters;
  const durationSec = totalDurationSeconds > 0
    ? totalDurationSeconds
    : null;
  const metersPerSecond = durationSec > 0 && totalMeters > 0
    ? totalMeters / durationSec
    : (totalMeters > 0 ? totalMeters / Math.max(driveSeconds, 1) : 22);

  const reachMeters = metersPerSecond * driveSeconds;
  const targetMeters = Math.min(index.totalMeters, startMeters + reachMeters);

  let endIndex = startIndex;
  for (let i = startIndex; i < index.cumulative.length; i += 1) {
    endIndex = i;
    if (index.cumulative[i] >= targetMeters) break;
  }

  const path = index.points.slice(startIndex, endIndex + 1);
  return {
    path,
    startMeters,
    endMeters: index.cumulative[endIndex] || targetMeters,
    startIndex,
    endIndex,
    reachMeters,
  };
}

/** Planned stops whose nearest route point falls inside the corridor window. */
export function stopsInExploreCorridor(stops = [], corridor, routePoints = []) {
  if (!corridor || corridor.endIndex < corridor.startIndex) return [];
  const index = buildRouteDistanceIndex(routePoints);
  if (index.points.length < 2) return [];

  return (stops || []).filter((stop) => {
    if (stop?.lat == null || stop?.lng == null) return false;
    const idx = nearestRouteIndex(index, stop.lat, stop.lng);
    const meters = index.cumulative[idx] || 0;
    return meters >= corridor.startMeters - 50 && meters <= corridor.endMeters + 50;
  });
}
