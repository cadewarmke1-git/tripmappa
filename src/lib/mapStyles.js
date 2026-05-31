import { DARK_MAP_STYLES, DAY_MAP_STYLES, NIGHT_MAP_STYLES, STANDARD_MAP_STYLES } from "./constants.js";

/** Resolve Google Map style array from app theme + map style picker. */
export function resolveMapStyles(mapStyle, theme) {
  if (mapStyle === "dark") return DARK_MAP_STYLES;
  if (mapStyle === "standard" && theme === "night") return NIGHT_MAP_STYLES;
  if (mapStyle === "standard" && theme === "day") return DAY_MAP_STYLES;
  if (mapStyle === "standard") return STANDARD_MAP_STYLES;
  return [];
}

/** Push resolved styles onto a live Maps instance (theme toggle / time-based switch). */
export function applyMapThemeStyles(map, mapStyle, theme) {
  if (!map?.setOptions) return;
  map.setOptions({ styles: resolveMapStyles(mapStyle, theme) });
}
