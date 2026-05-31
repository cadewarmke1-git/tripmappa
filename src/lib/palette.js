/** JS mirror of shared CSS palette constants (never theme-switched). */
export const GOLD_PRIMARY = "#FFD28C";
export const ORANGE_PRIMARY = "#FF8C42";
export const DEEP_DARK = "#1A0D00";
export const POLYLINE_COLOR = "#FFD28C";

/** Google Maps tile colors — night (depth + gold/purple hierarchy). */
export const MAP_NIGHT_BASE = "#1A1035";
export const MAP_NIGHT_SURFACE = "#241A42";
export const MAP_NIGHT_ELEVATED = "#2A1A4A";
export const MAP_NIGHT_HIGHWAY = "#4E3B42";
export const MAP_NIGHT_LABEL = "#A89BCF";
export const MAP_NIGHT_LABEL_ACCENT = "#FFD28C";
export const MAP_NIGHT_WATER = "#0D0A1A";

/** Google Maps tile colors — day (vintage road atlas). */
export const MAP_DAY_BASE = "#E8D5A8";
export const MAP_DAY_LOCAL_ROAD = "#C8956A";
export const MAP_DAY_HIGHWAY = "#F0DEB8";
export const MAP_DAY_ROAD_STROKE = "#A07850";
export const MAP_DAY_HIGHWAY_STROKE = "#8B3A0F";
export const MAP_DAY_LABEL = "#8B3A0F";
export const MAP_DAY_LABEL_PRIMARY = "#8B3A0F";
export const MAP_DAY_PARK = "#A8B890";
export const MAP_DAY_WATER = "#8AA8B8";

/** @deprecated Use MAP_DAY_LOCAL_ROAD */
export const MAP_DAY_PANEL = MAP_DAY_LOCAL_ROAD;
/** @deprecated Use MAP_DAY_HIGHWAY */
export const MAP_DAY_CARD = MAP_DAY_HIGHWAY;

/** Hero landing page typography + avatar accents (day/night). */
export const HERO_SURFACE_PALETTE = {
  night: {
    wordmarkGradient: "linear-gradient(90deg, #FFD28C 0%, #FF8C42 100%)",
    titleLine: "#FFFFFF",
    titleAccent: "#FFD28C",
    avatarGradient: "linear-gradient(135deg, #FFD28C 0%, #FF8C42 100%)",
    avatarText: DEEP_DARK,
    avatarRing: "0 0 0 2px rgba(255, 210, 140, 0.95), 0 0 16px rgba(255, 140, 66, 0.4)",
  },
  day: {
    wordmarkGradient: "linear-gradient(90deg, #C87010 0%, #E06820 100%)",
    titleLine: "#FFFFFF",
    titleAccent: DEEP_DARK,
    avatarGradient: "linear-gradient(135deg, #C87010 0%, #E06820 100%)",
    avatarText: DEEP_DARK,
    avatarRing: "0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 14px rgba(224, 104, 32, 0.35)",
  },
};
