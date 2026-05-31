/** JS mirror of shared CSS palette constants (never theme-switched). */
export const GOLD_PRIMARY = "#FFD28C";
export const ORANGE_PRIMARY = "#FF8C42";
export const DEEP_DARK = "#1A0D00";
export const POLYLINE_COLOR = "#FFD28C";

/** Google Maps tile colors — night (deep space purple + gold accents). */
export const MAP_NIGHT_BASE = "#1A1035";
export const MAP_NIGHT_SURFACE = "#241A42";
export const MAP_NIGHT_LOCAL_ROAD = "#2A1A4A";
export const MAP_NIGHT_ARTERIAL = "#3A2E5C";
/** ~45% #C8A060 over MAP_NIGHT_BASE — soft gold highway fill */
export const MAP_NIGHT_HIGHWAY = "#685148";
export const MAP_NIGHT_HIGHWAY_STROKE = "#8A7048";
export const MAP_NIGHT_LABEL = "#A89BCF";
export const MAP_NIGHT_LABEL_ACCENT = "#FFD28C";
export const MAP_NIGHT_WATER = "#0D0A1A";
export const MAP_NIGHT_PARK = "#1A2A1A";

/** @deprecated Use MAP_NIGHT_LOCAL_ROAD */
export const MAP_NIGHT_ELEVATED = MAP_NIGHT_LOCAL_ROAD;

/** Google Maps tile colors — day (warm amber desert terrain). */
export const MAP_DAY_BASE = "#D4A96A";
export const MAP_DAY_LOCAL_ROAD = "#C8956A";
/** Mid tone between terracotta local roads and deep-rust highways */
export const MAP_DAY_ARTERIAL = "#B06840";
export const MAP_DAY_HIGHWAY = "#8B3A0F";
export const MAP_DAY_ROAD_STROKE = "#704020";
export const MAP_DAY_HIGHWAY_STROKE = "#5A2408";
export const MAP_DAY_LABEL = "#3A1A08";
export const MAP_DAY_LABEL_PRIMARY = "#3A1A08";
export const MAP_DAY_PARK = "#A8B890";
export const MAP_DAY_WATER = "#8AA8B8";

/** @deprecated Use MAP_DAY_LOCAL_ROAD */
export const MAP_DAY_PANEL = MAP_DAY_LOCAL_ROAD;
/** @deprecated Use MAP_DAY_HIGHWAY */
export const MAP_DAY_CARD = MAP_DAY_HIGHWAY;

/**
 * Hero landing chrome — canonical palette (follows sky day/night cycle).
 * Gold is the base accent family; wordmark + profile use gold gradients.
 *
 * Night: wordmark #FFD28C→#FF8C42, Travel #5A3A9A→#FFD28C, Reimagined #FF8C42→#C87010
 * Day:   wordmark #C87010→#E06820, Travel #FFD28C→#FF8C42, Reimagined #FF8C42→#C87010
 */
export const HERO_SURFACE_PALETTE = {
  night: {
    wordmarkGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    titleLineGradient: "linear-gradient(90deg, #5A3A9A 0%, #FFD28C 100%)",
    titleAccentGradient: "linear-gradient(90deg, #FF8C42 0%, #C87010 100%)",
    subtitle: "rgba(255, 255, 255, 0.8)",
    avatarGradient: "linear-gradient(135deg, #FFD28C 0%, #FF8C42 100%)",
    avatarText: DEEP_DARK,
    avatarRing: "0 0 0 2px rgba(255, 210, 140, 0.95), 0 0 16px rgba(255, 140, 66, 0.45)",
  },
  day: {
    wordmarkGradient: "linear-gradient(90deg, #C87010 0%, #E06820 100%)",
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
