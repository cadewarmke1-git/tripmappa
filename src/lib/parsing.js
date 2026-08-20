export function parseMilesFromDistance(distanceStr) {
  if (!distanceStr) return null;
  const mi = String(distanceStr).match(/([\d,.]+)\s*mi/i);
  if (mi) return parseFloat(mi[1].replace(",", ""));
  const km = String(distanceStr).match(/([\d,.]+)\s*km/i);
  if (km) return parseFloat(km[1].replace(",", "")) * 0.621371;
  return null;
}

export function parseHoursFromDuration(durationStr) {
  if (!durationStr) return null;
  const s = String(durationStr);
  const days = s.match(/(\d+)\s*d(?:ays?)?/i);
  const hoursMatch = s.match(/(\d+)\s*h(?:ours?)?/i);
  const minsMatch = s.match(/(\d+)\s*mins?\b/i) || s.match(/(\d+)\s*minutes?\b/i);
  const hours = (days ? parseInt(days[1], 10) * 24 : 0)
    + (hoursMatch ? parseInt(hoursMatch[1], 10) : 0);
  const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;
  const total = hours + mins / 60;
  return total > 0 ? total : null;
}
