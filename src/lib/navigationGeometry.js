/** Geometry helpers for turn-by-turn navigation — distances, polyline projection. */

const EARTH_RADIUS_M = 6371000;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toLatLng(point) {
  if (!point) return null;
  const lat = typeof point.lat === "function" ? point.lat() : point.lat;
  const lng = typeof point.lng === "function" ? point.lng() : point.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Squared distance from point P to segment AB (planar approx for short segments). */
function distSqToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    return (px - ax) ** 2 + (py - ay) ** 2;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

/**
 * Closest point on a polyline and distance in meters.
 * @returns {{ point: {lat,lng}, distanceMeters: number, segmentIndex: number, progress: number }}
 */
export function closestPointOnPolyline(position, path = []) {
  const pos = toLatLng(position);
  if (!pos || path.length < 2) {
    return { point: pos, distanceMeters: Infinity, segmentIndex: 0, progress: 0 };
  }

  let bestDist = Infinity;
  let bestPoint = pos;
  let bestSeg = 0;
  let accumulated = 0;
  const segLengths = [];

  for (let i = 0; i < path.length - 1; i++) {
    const a = toLatLng(path[i]);
    const b = toLatLng(path[i + 1]);
    if (!a || !b) {
      segLengths.push(0);
      continue;
    }
    const len = haversineMeters(a.lat, a.lng, b.lat, b.lng);
    segLengths.push(len);

    const latScale = 111320;
    const lngScale = 111320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    const dSq = distSqToSegment(
      pos.lat * latScale, pos.lng * lngScale,
      a.lat * latScale, a.lng * lngScale,
      b.lat * latScale, b.lng * lngScale,
    );
    if (dSq < bestDist) {
      bestDist = dSq;
      const dx = (b.lng - a.lng) * lngScale;
      const dy = (b.lat - a.lat) * latScale;
      let t = 0;
      if (dx !== 0 || dy !== 0) {
        t = Math.max(0, Math.min(1, ((pos.lng * lngScale - a.lng * lngScale) * dx + (pos.lat * latScale - a.lat * latScale) * dy) / (dx * dx + dy * dy)));
      }
      bestPoint = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
      bestSeg = i;
    }
  }

  const totalLen = segLengths.reduce((s, l) => s + l, 0);
  for (let i = 0; i < bestSeg; i++) accumulated += segLengths[i];
  const segLen = segLengths[bestSeg] || 0;
  const segProgress = segLen > 0
    ? haversineMeters(
      toLatLng(path[bestSeg]).lat, toLatLng(path[bestSeg]).lng,
      bestPoint.lat, bestPoint.lng,
    ) / segLen
    : 0;
  const progress = totalLen > 0 ? (accumulated + segProgress * segLen) / totalLen : 0;

  const latScale = 111320;
  const lngScale = 111320 * Math.cos(pos.lat * Math.PI / 180);
  const distMeters = Math.sqrt(bestDist) * Math.min(latScale, lngScale);

  return {
    point: bestPoint,
    distanceMeters: Number.isFinite(distMeters) ? distMeters : haversineMeters(pos.lat, pos.lng, bestPoint.lat, bestPoint.lng),
    segmentIndex: bestSeg,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

/** Remaining polyline distance from closest point to end, in meters. */
export function remainingPolylineMeters(path, closest) {
  if (!path?.length || path.length < 2) return 0;
  const points = path.map(toLatLng).filter(Boolean);
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = closest.segmentIndex + 1; i < points.length - 1; i++) {
    total += haversineMeters(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  const segStart = toLatLng(path[closest.segmentIndex]);
  const segEnd = toLatLng(path[closest.segmentIndex + 1]);
  if (segStart && segEnd && closest.point) {
    total += haversineMeters(closest.point.lat, closest.point.lng, segEnd.lat, segEnd.lng);
  }
  return total;
}

export function formatDistanceShort(meters) {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  if (meters < 1609) {
    const ft = Math.round(meters * 3.28084);
    if (ft < 1000) return `${ft} ft`;
    return `${(meters / 1609.344).toFixed(1)} mi`;
  }
  const mi = meters / 1609.344;
  return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
}

export function formatDurationShort(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return "< 1 min";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

export function bearingDegrees(from, to) {
  if (!from || !to) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lng);
  const lat2 = toRad(to.lat);
  const lon2 = toRad(to.lng);
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
