/** Gold vintage car PNG marker for in-app navigation (Google Maps). */

export const CAR_MARKER_PATH = "/markers/vintage-car.png";
export const CAR_MARKER_DISPLAY_WIDTH = 40;
export const CAR_MARKER_DISPLAY_HEIGHT = 20;

/** Bearing between two lat/lng points, in degrees (0 = north, clockwise). */
export function getBearing(from, to) {
  if (!from || !to) return 0;
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lon1 = toRad(from.lng);
  const lat2 = toRad(to.lat);
  const lon2 = toRad(to.lng);
  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function buildNavigationCarMarkerIcon() {
  if (typeof window === "undefined" || !window.google?.maps) return null;
  const w = CAR_MARKER_DISPLAY_WIDTH;
  const h = CAR_MARKER_DISPLAY_HEIGHT;
  return {
    url: CAR_MARKER_PATH,
    scaledSize: new window.google.maps.Size(w, h),
    anchor: new window.google.maps.Point(w / 2, h / 2),
  };
}

export function computePathHeadingDegrees(path = []) {
  if (!path?.length || path.length < 2) return 0;
  const a = path[0];
  const b = path[1];
  if (window.google?.maps?.geometry?.spherical) {
    const latLngA = new window.google.maps.LatLng(a.lat, a.lng);
    const latLngB = new window.google.maps.LatLng(b.lat, b.lng);
    const heading = window.google.maps.geometry.spherical.computeHeading(latLngA, latLngB);
    return Number.isFinite(heading) ? heading : getBearing(a, b);
  }
  return getBearing(a, b);
}

/** Rotate the marker image to match travel heading (PNG art points north). */
export function applyMarkerRotation(marker, headingDeg) {
  const el = marker?.getElement?.();
  if (!el) return;
  const img = el.querySelector("img");
  const target = img || el;
  target.style.transformOrigin = "center center";
  target.style.transform = `rotate(${headingDeg}deg)`;
}

/** @deprecated use CAR_MARKER_PATH */
export function navigationCarIconUrl() {
  return CAR_MARKER_PATH;
}
