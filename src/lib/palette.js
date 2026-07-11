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

/** Google Maps tile colors — night (warm charcoal land + muted gold highways). */
export const MAP_NIGHT_BASE = "#15120C";
export const MAP_NIGHT_LOCAL_ROAD = "#3A3228";
export const MAP_NIGHT_ARTERIAL = "#4A4034";
/** #C8A060 at 30% over land base */
export const MAP_NIGHT_HIGHWAY = blendHex(MAP_NIGHT_HIGHWAY_GOLD, MAP_NIGHT_BASE, 0.3);
/** #C8A060 at 50% over land base */
export const MAP_NIGHT_HIGHWAY_STROKE = blendHex(MAP_NIGHT_HIGHWAY_GOLD, MAP_NIGHT_BASE, 0.5);
export const MAP_NIGHT_LABEL = "#B8A48C";
export const MAP_NIGHT_LABEL_ACCENT = "#FFD28C";
export const MAP_NIGHT_WATER = "#141C22";
export const MAP_NIGHT_PARK = "#1C1812";

/** Google Maps tile colors — day (muted sand land + warm grey roads). */
export const MAP_DAY_BASE = "#F5E6C8";
export const MAP_DAY_LOCAL_ROAD = "#B8AEA0";
export const MAP_DAY_ARTERIAL = "#C4B8A8";
export const MAP_DAY_HIGHWAY = "#C8956A";
export const MAP_DAY_ROAD_STROKE = "#9A8878";
export const MAP_DAY_HIGHWAY_STROKE = "#8A6848";
export const MAP_DAY_LABEL = "#5A4030";
export const MAP_DAY_LABEL_PRIMARY = "#3A2818";
export const MAP_DAY_PARK = "#D4C8B0";
export const MAP_DAY_WATER = "#8A9EA8";

/**
 * Hero landing chrome — canonical palette (follows sky day/night cycle).
 * Gold is the base accent family; wordmark + profile use gold gradients.
 *
 * Night: wordmark #FFD28C→#FF8C42, Title #FFFFFF→#F5E6C8, Accent #FFD28C→#FF8C42
 * Day:   wordmark #FFD28C→#FF8C42, Title #FFFFFF→#F5E6C8, Accent #FF8C42→#FFD28C
 */
export const HERO_SURFACE_PALETTE = {
  night: {
    wordmarkGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    titleLineGradient: "linear-gradient(90deg, #FFFFFF 0%, #F5E6C8 100%)",
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
    avatarGradient: "linear-gradient(135deg, #FFD28C 0%, #FF8C42 100%)",
    avatarText: DEEP_DARK,
    avatarRing: "0 0 0 2px rgba(255, 210, 140, 0.95), 0 0 16px rgba(255, 140, 66, 0.45)",
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
