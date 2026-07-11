import {
  DAY_MAP_STYLES,
  DARK_MAP_STYLES,
  NIGHT_MAP_STYLES,
} from "./constants.js";
import { MAP_DAY_BASE, MAP_NIGHT_BASE } from "./palette.js";

/** Day vs night bucket — twilight uses the night palette. */
export function resolveMapThemeBucket(theme) {
  return theme === "day" ? "day" : "night";
}

/** Resolve Google Map style array from app theme + map style picker. */
export function resolveMapStyles(mapStyle, theme) {
  if (mapStyle === "satellite") return [];
  if (mapStyle === "dark") return DARK_MAP_STYLES;
  return resolveMapThemeBucket(theme) === "day" ? DAY_MAP_STYLES : NIGHT_MAP_STYLES;
}

/** Tile background while map loads — matches styled land so tiles do not flash default blue/green. */
export function getMapBackgroundColor(mapStyle, theme) {
  if (mapStyle === "satellite") return undefined;
  return resolveMapThemeBucket(theme) === "day" ? MAP_DAY_BASE : MAP_NIGHT_BASE;
}

/** Push resolved styles onto a live Maps instance (theme toggle / time-based switch). */
export function applyMapThemeStyles(map, mapStyle, theme) {
  if (!map?.setOptions) return;
  const styles = resolveMapStyles(mapStyle, theme);
  const backgroundColor = getMapBackgroundColor(mapStyle, theme);
  map.setOptions({
    styles: styles ?? [],
    ...(backgroundColor ? { backgroundColor } : {}),
  });
}
