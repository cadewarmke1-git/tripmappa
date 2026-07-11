const US_CENTER = { lat: 37.0902, lng: -95.7129 };

function normalizePoint(point) {
  if (!point) return null;
  const lat = typeof point.lat === "function" ? point.lat() : point.lat;
  const lng = typeof point.lng === "function" ? point.lng() : point.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/** Rough center + zoom from route points so the map opens near the trip, not continental US. */
export function getRouteMapViewport(points) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const valid = points.map(normalizePoint).filter(Boolean);
  if (valid.length < 2) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const p of valid) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const center = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.02);
  let zoom = 8;
  if (span > 8) zoom = 4;
  else if (span > 4) zoom = 5;
  else if (span > 2) zoom = 6;
  else if (span > 1) zoom = 7;
  else if (span > 0.5) zoom = 8;
  else if (span > 0.25) zoom = 9;
  else zoom = 10;

  return { center, zoom: Math.min(zoom, 12) };
}

export function resolveMapCenter(routeInfo, routePath, fallback = US_CENTER) {
  const pathPoints = Array.isArray(routePath) && routePath.length > 1
    ? routePath
    : routeInfo?.routePoints;
  const fromPath = getRouteMapViewport(pathPoints);
  if (fromPath) return fromPath.center;

  if (routeInfo?.originLat != null && routeInfo?.destLat != null) {
    return {
      lat: (routeInfo.originLat + routeInfo.destLat) / 2,
      lng: (routeInfo.originLng + routeInfo.destLng) / 2,
    };
  }

  return fallback;
}

export { US_CENTER };
