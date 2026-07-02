/** Map pin SVGs — vintage neon sign silhouettes (miniatures of popup shapes). */
import { markerToSignCategory } from "./neonSignCategory.js";

const STROKE = "#1a1528";
const SIGN_FILL = {
  food: "#ff5fa8",
  fuel: "#3dd9d0",
  lodging: "#ff8c42",
  general: "#ffd28c",
};

function shapePath(signCategory) {
  switch (signCategory) {
    case "food":
      return '<ellipse cx="16" cy="16" rx="13" ry="10.5" fill="CURRENT" stroke="STROKE" stroke-width="1.4"/>';
    case "fuel":
      return '<path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" fill="CURRENT" stroke="STROKE" stroke-width="1.4" stroke-linejoin="round"/>';
    case "lodging":
      return '<path d="M5 8 H27 V22 L16 28 L5 22 Z" fill="CURRENT" stroke="STROKE" stroke-width="1.4" stroke-linejoin="round"/>';
    default:
      return '<rect x="5" y="7" width="22" height="18" rx="5" fill="CURRENT" stroke="STROKE" stroke-width="1.4"/>';
  }
}

function miniGlyph(signCategory) {
  switch (signCategory) {
    case "food":
      return '<path d="M11 22V13c0-2 .8-3 2.5-3s2.5 1 2.5 3v9M17 22V11c0-2 .8-3 2.5-3" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
    case "fuel":
      return '<path d="M13 22V11l2-1.5 2 1.5v11" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
    case "lodging":
      return '<path d="M10 21V14l6-4 6 4v7" stroke="#fff" stroke-width="1.2" fill="none" stroke-linejoin="round"/>';
    default:
      return '<circle cx="16" cy="16" r="2.5" fill="#fff"/>';
  }
}

export function buildNeonSignPinSvg(category, { pinNumber = null, pinSize = "normal" } = {}) {
  const signCategory = markerToSignCategory(category);
  const fill = SIGN_FILL[signCategory] || SIGN_FILL.general;
  const size = pinSize === "large" ? 36 : (pinNumber != null ? 32 : 28);
  const shape = shapePath(signCategory)
    .replace(/CURRENT/g, fill)
    .replace(/STROKE/g, STROKE);
  const numberLabel = pinNumber != null
    ? `<text x="16" y="20" text-anchor="middle" font-size="10" font-weight="800" fill="${STROKE}">${pinNumber}</text>`
    : miniGlyph(signCategory);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">${shape}${numberLabel}</svg>`;
}

export function buildNeonSignPinIcon(category, options = {}) {
  const pinSize = options.pinSize || "normal";
  const pinNumber = options.pinNumber ?? null;
  const size = pinSize === "large" ? 36 : (pinNumber != null ? 32 : 28);
  const svg = buildNeonSignPinSvg(category, { pinNumber, pinSize });
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  if (typeof window === "undefined" || !window.google?.maps) {
    return { url };
  }
  return {
    url,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  };
}
