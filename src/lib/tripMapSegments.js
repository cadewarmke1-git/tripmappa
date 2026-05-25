/** Route segment analysis for night driving and fuel risk highlights. */

export function computeNightSegments(routePoints, departureTime, totalHours) {
  if (!routePoints?.length || !departureTime || !totalHours) return [];
  const start = departureTime instanceof Date ? departureTime : new Date(departureTime);
  if (Number.isNaN(start.getTime())) return [];

  const segments = [];
  const segCount = Math.max(1, routePoints.length - 1);
  const hoursPerSeg = totalHours / segCount;

  for (let i = 0; i < segCount; i++) {
    const segStart = new Date(start.getTime() + i * hoursPerSeg * 3600000);
    const hour = segStart.getHours();
    if (hour >= 22 || hour < 6) {
      segments.push({
        index: i,
        path: routePoints.slice(
          Math.floor(i * routePoints.length / segCount),
          Math.floor((i + 1) * routePoints.length / segCount) + 1,
        ),
      });
    }
  }
  return segments;
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
