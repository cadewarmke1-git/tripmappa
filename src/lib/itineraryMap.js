/** Split route polyline into per-day paths for colored map display. */
import { DAY_ROUTE_COLORS } from "./constants.js";

export function computeDayRoutePaths(routePoints, stopCount) {
  if (!routePoints?.length) return [];
  const days = Math.max(1, stopCount || 1);
  const paths = [];
  const n = routePoints.length;

  for (let d = 0; d < days; d++) {
    const startFrac = d / days;
    const endFrac = (d + 1) / days;
    const i0 = Math.floor(startFrac * (n - 1));
    const i1 = Math.min(n - 1, Math.ceil(endFrac * (n - 1)));
    const slice = routePoints.slice(i0, i1 + 1);
    if (slice.length > 1) {
      paths.push({
        dayIndex: d,
        color: DAY_ROUTE_COLORS[d % DAY_ROUTE_COLORS.length],
        path: slice,
      });
    }
  }
  return paths;
}

export { DAY_ROUTE_COLORS };
