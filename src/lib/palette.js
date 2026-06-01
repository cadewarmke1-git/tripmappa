/** JS mirror of shared CSS palette constants (never theme-switched). */
export const GOLD_PRIMARY = "#FFD28C";
export const ORANGE_PRIMARY = "#FF8C42";
export const DEEP_DARK = "#1A0D00";
export const POLYLINE_COLOR = "#FFD28C";

/** Blend a foreground hex onto a background at given opacity (Google Maps has no alpha in color). */
function blendHex(fg, bg, fgOpacity) {
  const fgR = parseInt(fg.slice(1, 3), 16);
  const fgG = parseInt(fg.slice(3, 5), 16);
  const fgB = parseInt(fg.slice(5, 7), 16);
  const bgR = parseInt(bg.slice(1, 3), 16);
  const bgG = parseInt(bg.slice(3, 5), 16);
  const bgB = parseInt(bg.slice(5, 7), 16);
  const t = fgOpacity;
  const r = Math.round(fgR * t + bgR * (1 - t));
  const g = Math.round(fgG * t + bgG * (1 - t));
  const b = Math.round(fgB * t + bgB * (1 - t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const MAP_NIGHT_HIGHWAY_GOLD = "#C8A060";

/** Google Maps tile colors — night (deep space purple + gold accents). */
export const MAP_NIGHT_BASE = "#1A1035";
export const MAP_NIGHT_SURFACE = "#241A42";
export const MAP_NIGHT_LOCAL_ROAD = "#2A1A4A";
export const MAP_NIGHT_ARTERIAL = "#2A1A4A";
/** #C8A060 at 30% over land base */
export const MAP_NIGHT_HIGHWAY = blendHex(MAP_NIGHT_HIGHWAY_GOLD, MAP_NIGHT_BASE, 0.3);
/** #C8A060 at 50% over land base */
export const MAP_NIGHT_HIGHWAY_STROKE = blendHex(MAP_NIGHT_HIGHWAY_GOLD, MAP_NIGHT_BASE, 0.5);
export const MAP_NIGHT_LABEL = "#A89BCF";
export const MAP_NIGHT_LABEL_ACCENT = "#FFD28C";
export const MAP_NIGHT_WATER = "#0D0A1A";
export const MAP_NIGHT_PARK = "#1A2A1A";

/** @deprecated Use MAP_NIGHT_LOCAL_ROAD */
export const MAP_NIGHT_ELEVATED = MAP_NIGHT_LOCAL_ROAD;

/** Google Maps tile colors — day (classic road atlas: cool base, warm roads). */
export const MAP_DAY_BASE = "#F0EDE8";
export const MAP_DAY_LOCAL_ROAD = "#C8956A";
export const MAP_DAY_ARTERIAL = "#C8956A";
export const MAP_DAY_HIGHWAY = "#E06820";
export const MAP_DAY_ROAD_STROKE = "#A87048";
export const MAP_DAY_HIGHWAY_STROKE = "#5A2A10";
export const MAP_DAY_LABEL = "#3A1A08";
export const MAP_DAY_LABEL_PRIMARY = "#3A1A08";
export const MAP_DAY_PARK = "#6B8F5E";
export const MAP_DAY_WATER = "#4A8AB8";

/** @deprecated Use MAP_DAY_LOCAL_ROAD */
export const MAP_DAY_PANEL = MAP_DAY_LOCAL_ROAD;
/** @deprecated Use MAP_DAY_HIGHWAY */
export const MAP_DAY_CARD = MAP_DAY_HIGHWAY;

/**
 * Hero landing chrome — canonical palette (follows sky day/night cycle).
 * Gold is the base accent family; wordmark + profile use gold gradients.
 *
 * Night: wordmark #FFD28C→#FF8C42, Travel #5A3A9A→#FFD28C, Reimagined #FFD28C→#FF8C42
 * Day:   wordmark #FFD28C→#FF8C42, Travel #FFD28C→#FF8C42, Reimagined #FF8C42→#C87010
 */
export const HERO_SURFACE_PALETTE = {
  night: {
    wordmarkGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    titleLineGradient: "linear-gradient(90deg, #5A3A9A 0%, #FFD28C 100%)",
    titleAccentGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    subtitle: "rgba(255, 255, 255, 0.8)",
    avatarGradient: "linear-gradient(135deg, #FFD28C 0%, #FF8C42 100%)",
    avatarText: DEEP_DARK,
    avatarRing: "0 0 0 2px rgba(255, 210, 140, 0.95), 0 0 16px rgba(255, 140, 66, 0.45)",
  },
  day: {
    wordmarkGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    titleLineGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    titleAccentGradient: "linear-gradient(90deg, #FF8C42 0%, #C87010 100%)",
    subtitle: "rgba(255, 255, 255, 0.85)",
    avatarGradient: "linear-gradient(135deg, #C87010 0%, #E06820 100%)",
    avatarText: DEEP_DARK,
    avatarRing: "0 0 0 2px rgba(200, 112, 16, 0.92), 0 0 14px rgba(224, 104, 32, 0.42)",
  },
};

/** Inline CSS vars — work with existing !important rules that use var(--color-*). */
export function getHeroSurfaceCssVars(theme) {
  const p = HERO_SURFACE_PALETTE[theme];
  if (!p) return undefined;
  return {
    "--color-wordmark-gradient": p.wordmarkGradient,
    "--color-accent-gradient": p.avatarGradient,
    "--color-hero-title-gradient": p.titleLineGradient,
    "--color-hero-accent-gradient": p.titleAccentGradient,
    "--color-hero-subtitle": p.subtitle,
  };
}
