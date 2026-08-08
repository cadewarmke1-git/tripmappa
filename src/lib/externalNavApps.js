/** Detect installed / platform-capable nav apps and build destination deep links. */

export function resolveDestinationCoords({ routeInfo, routePoints, truckRoutePath, lat, lng } = {}) {
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  if (Number.isFinite(routeInfo?.destLat) && Number.isFinite(routeInfo?.destLng)) {
    return { lat: routeInfo.destLat, lng: routeInfo.destLng };
  }
  const path = (routePoints?.length > 1 ? routePoints : null)
    || (truckRoutePath?.length > 1 ? truckRoutePath : null)
    || routeInfo?.routePoints;
  if (path?.length) {
    const last = path[path.length - 1];
    if (Number.isFinite(last?.lat) && Number.isFinite(last?.lng)) {
      return { lat: last.lat, lng: last.lng };
    }
  }
  return null;
}

/**
 * Best-effort app availability on the web.
 * True install detection via custom schemes is unreliable in browsers;
 * we use platform capability + universal https links.
 */
export function detectNavApps(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  const ua = String(userAgent || "");
  const isApple = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isApple || isAndroid || /Mobile/i.test(ua);

  return {
    appleMaps: isApple,
    googleMaps: true,
    waze: isMobile || isAndroid || isApple,
  };
}

export function buildExternalNavUrl(appId, coords, destinationLabel = "") {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return null;
  const { lat, lng } = coords;
  const label = encodeURIComponent(destinationLabel || `${lat},${lng}`);

  if (appId === "apple") {
    return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  }
  if (appId === "google") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  if (appId === "waze") {
    return `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes&q=${label}`;
  }
  return null;
}

export const EXTERNAL_NAV_APPS = [
  {
    id: "apple",
    detectKey: "appleMaps",
    label: "Apple Maps",
    blurb: "Best when your phone is connected to CarPlay",
  },
  {
    id: "google",
    detectKey: "googleMaps",
    label: "Google Maps",
    blurb: "Dashboard-ready if Google Maps is on CarPlay or Android Auto",
  },
  {
    id: "waze",
    detectKey: "waze",
    label: "Waze",
    blurb: "Live traffic and police alerts on a dashboard display",
  },
];
