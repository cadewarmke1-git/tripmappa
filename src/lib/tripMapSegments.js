/** Route segment analysis — night driving blocks and fuel risk highlights. */

function isNightHour(date) {
  const h = date.getHours();
  return h >= 22 || h < 6;
}

function sliceRouteByFraction(routePoints, startFrac, endFrac) {
  if (!routePoints?.length) return [];
  const n = routePoints.length;
  const i0 = Math.max(0, Math.floor(startFrac * (n - 1)));
  const i1 = Math.min(n - 1, Math.ceil(endFrac * (n - 1)));
  return routePoints.slice(i0, i1 + 1);
}

/**
 * Consolidate driving time into continuous night blocks (10 PM – 6 AM).
 * Returns one entry per continuous night period — never one per route segment.
 */
export function computeNightDrivingBlocks(departureTime, totalHours, routePoints) {
  if (!departureTime || !totalHours || totalHours <= 0) return [];
  const start = departureTime instanceof Date ? departureTime : new Date(departureTime);
  if (Number.isNaN(start.getTime())) return [];

  const stepHours = 0.25;
  const steps = Math.ceil(totalHours / stepHours);
  const rawBlocks = [];
  let current = null;

  for (let s = 0; s <= steps; s++) {
    const hourOffset = Math.min(s * stepHours, totalHours);
    const clock = new Date(start.getTime() + hourOffset * 3600000);
    if (isNightHour(clock)) {
      if (!current) current = { startHour: hourOffset, endHour: hourOffset };
      else current.endHour = hourOffset;
    } else if (current) {
      rawBlocks.push(current);
      current = null;
    }
  }
  if (current) rawBlocks.push(current);

  return rawBlocks.map((block, index) => ({
    index,
    startHour: block.startHour,
    endHour: block.endHour,
    path: sliceRouteByFraction(routePoints, block.startHour / totalHours, block.endHour / totalHours),
  }));
}

/** @deprecated Use computeNightDrivingBlocks */
export function computeNightSegments(routePoints, departureTime, totalHours) {
  return computeNightDrivingBlocks(departureTime, totalHours, routePoints);
}

export function computeLowFuelSegmentPath(routePoints, fuelStopIndices, rangeMiles, totalMiles) {
  if (!routePoints?.length || !rangeMiles) return [];
  const paths = [];
  const intervalMiles = totalMiles / Math.max(1, routePoints.length - 1);
  let lastFuelIdx = 0;

  for (let i = 1; i < routePoints.length; i++) {
    const milesSinceFuel = (i - lastFuelIdx) * intervalMiles;
    if (fuelStopIndices?.includes(i)) lastFuelIdx = i;
    if (milesSinceFuel > rangeMiles) {
      paths.push(routePoints.slice(lastFuelIdx, i + 1));
    }
  }
  return paths;
}

export function computeRestBreakPoints(totalHours, intervalMinutes = 90) {
  if (!totalHours || totalHours <= intervalMinutes / 60) return [];
  const breaks = [];
  const intervalHours = intervalMinutes / 60;
  for (let h = intervalHours; h < totalHours; h += intervalHours) {
    breaks.push({ hourOffset: h, label: `Rest break at ~${Math.floor(h)}h` });
  }
  return breaks;
}
