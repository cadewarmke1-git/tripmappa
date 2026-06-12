/** Inline gold car SVG marker for in-app navigation (no external assets). */

const GOLD = "#FFD28C";
const OUTLINE = "#1a1a2e";

function buildCarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="44" viewBox="0 0 28 44">
    <path d="M14 3 L20 14 L22 30 Q14 38 6 30 L8 14 Z" fill="${GOLD}" stroke="${OUTLINE}" stroke-width="1.4" stroke-linejoin="round"/>
    <rect x="10" y="12" width="8" height="6" rx="1.2" fill="${OUTLINE}" opacity="0.35"/>
    <circle cx="9" cy="32" r="2.2" fill="${OUTLINE}"/>
    <circle cx="19" cy="32" r="2.2" fill="${OUTLINE}"/>
  </svg>`;
}

export function navigationCarIconUrl() {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildCarSvg())}`;
}

/** @param {number} headingDegrees bearing from north (Google Maps rotation) */
export function buildNavigationCarMarkerIcon(headingDegrees = 0) {
  if (typeof window === "undefined" || !window.google?.maps) return null;
  return {
    url: navigationCarIconUrl(),
    scaledSize: new window.google.maps.Size(28, 44),
    anchor: new window.google.maps.Point(14, 22),
    rotation: headingDegrees,
  };
}

export function computePathHeadingDegrees(path = []) {
  if (!path?.length || path.length < 2 || !window.google?.maps?.geometry?.spherical) return 0;
  const a = path[0];
  const b = path[1];
  const latLngA = new window.google.maps.LatLng(a.lat, a.lng);
  const latLngB = new window.google.maps.LatLng(b.lat, b.lng);
  return window.google.maps.geometry.spherical.computeHeading(latLngA, latLngB);
}
