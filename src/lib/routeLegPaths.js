/** Extract per-leg path slices for map highlight from route points and waypoint coords. */

function toPoint(p) {
  if (!p) return null;
  const lat = typeof p.lat === "function" ? p.lat() : p.lat;
  const lng = typeof p.lng === "function" ? p.lng() : p.lng;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function nearestIndex(routePoints, target) {
  const pt = toPoint(target);
  if (!pt || !routePoints?.length) return 0;
  let best = 0;
  let bestDist = Infinity;
  routePoints.forEach((p, i) => {
    const rp = toPoint(p);
    if (!rp) return;
    const d = (rp.lat - pt.lat) ** 2 + (rp.lng - pt.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/**
 * @param {object[]} routePoints full route polyline
 * @param {object[]} anchors ordered lat/lng — origin + included stops + destination
 * @param {number} legIndex 0 = origin → first stop
 */
export function sliceRouteLegPath(routePoints, anchors, legIndex) {
  if (!routePoints?.length || !anchors?.length || legIndex < 0) return [];
  const startAnchor = anchors[legIndex];
  const endAnchor = anchors[legIndex + 1];
  if (!startAnchor || !endAnchor) return [];

  const i0 = nearestIndex(routePoints, startAnchor);
  const i1 = nearestIndex(routePoints, endAnchor);
  const from = Math.min(i0, i1);
  const to = Math.max(i0, i1);
  return routePoints.slice(from, to + 1).map(toPoint).filter(Boolean);
}

export function buildAnchorPointsFromWaypoints(waypoints = []) {
  const anchors = [];
  const origin = waypoints.find(w => w.kind === "origin");
  if (origin?.lat != null) anchors.push({ lat: origin.lat, lng: origin.lng });
  for (const w of waypoints) {
    if (w.kind !== "stop" || !w.included) continue;
    if (w.lat != null && w.lng != null) anchors.push({ lat: w.lat, lng: w.lng });
  }
  const dest = waypoints.find(w => w.kind === "destination");
  if (dest?.lat != null) anchors.push({ lat: dest.lat, lng: dest.lng });
  return anchors;
}
