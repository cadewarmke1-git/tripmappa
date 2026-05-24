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
  const h = String(durationStr).match(/(\d+)\s*h/i);
  const m = String(durationStr).match(/(\d+)\s*m/i);
  const hours = h ? parseInt(h[1], 10) : 0;
  const mins = m ? parseInt(m[1], 10) : 0;
  return hours + mins / 60 || null;
}
