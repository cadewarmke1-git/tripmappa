/** Build geolocated trip tips for proximity alerts during navigation. */
import { normalizeTripTip } from "./tripTips.js";

const PROXIMITY_MILES = 20;

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const PROXIMITY_ALERT_RADIUS_MILES = PROXIMITY_MILES;

function sampleRoutePoints(routePoints, count) {
  if (!routePoints?.length) return [];
  if (routePoints.length <= count) return routePoints;
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / Math.max(1, count - 1)) * (routePoints.length - 1));
    out.push(routePoints[idx]);
  }
  return out;
}

export function inferProximityAlertType(text = "") {
  const blob = String(text).toLowerCase();
  if (/(weather|rain|snow|storm|ice|wind|flood|hail|tornado|blizzard|temperature|precipitation|°f|fahrenheit)/i.test(blob)) {
    return "weather";
  }
  if (/(construction|closure|closed|detour|road work|blocked|lane)/i.test(blob)) {
    return "construction";
  }
  if (/(traffic|delay|congestion|incident|accident|reroute|jam)/i.test(blob)) {
    return "traffic";
  }
  return "traffic";
}

function isRelevantAlertText(text = "") {
  const blob = String(text).toLowerCase();
  return /(weather|rain|snow|storm|ice|wind|flood|construction|closure|closed|detour|traffic|delay|congestion|incident|accident|blocked|road work|hazard|warning|restriction)/i.test(blob);
}

function cityCoords(weatherByCity, city) {
  if (!city || !weatherByCity) return null;
  const w = weatherByCity[city];
  if (w?.lat == null || w?.lng == null) return null;
  return { lat: w.lat, lng: w.lng };
}

function pushTip(out, seen, tip) {
  if (!tip?.id || seen.has(tip.id)) return;
  if (tip.lat == null || tip.lng == null) return;
  seen.add(tip.id);
  out.push(tip);
}

/** Merge trip tips, live tips, and route alerts into tips with map positions. */
export function buildProximityTips({
  tripTips = [],
  liveTripTips = [],
  tripAlerts = [],
  weatherByCity = {},
  routePoints = [],
} = {}) {
  const out = [];
  const seen = new Set();

  for (const alert of tripAlerts) {
    const text = `${alert?.title || ""} ${alert?.message || ""}`;
    if (alert?.type !== "weather" && !isRelevantAlertText(text)) continue;
    const coords = alert.lat != null && alert.lng != null
      ? { lat: alert.lat, lng: alert.lng }
      : cityCoords(weatherByCity, alert.city);
    if (!coords) continue;
    pushTip(out, seen, {
      id: alert.id || `alert-${alert.type}-${alert.title}`,
      title: alert.title || "Route alert",
      text: alert.message || alert.title || "",
      type: alert.type === "weather" ? "weather" : inferProximityAlertType(text),
      lat: coords.lat,
      lng: coords.lng,
    });
  }

  const normalized = [
    ...liveTripTips.map(normalizeTripTip),
    ...tripTips.map(normalizeTripTip),
  ].filter(Boolean).filter(t => isRelevantAlertText(`${t.title} ${t.detail}`));

  const samples = sampleRoutePoints(routePoints, Math.max(4, normalized.length));
  normalized.forEach((tip, i) => {
    const pt = samples[i % samples.length];
    if (pt?.lat == null) return;
    const text = `${tip.title} ${tip.detail}`;
    pushTip(out, seen, {
      id: `proximity-tip-${i}-${tip.title}`,
      title: tip.title,
      text: tip.detail || tip.title,
      type: inferProximityAlertType(text),
      lat: pt.lat,
      lng: pt.lng,
    });
  });

  return out;
}

export function findProximityTip(userLocation, tips, handledIds = new Set(), radiusMiles = PROXIMITY_MILES) {
  if (!userLocation?.lat || !userLocation?.lng || !tips?.length) return null;
  let closest = null;
  let closestDist = Infinity;
  for (const tip of tips) {
    if (handledIds.has(tip.id)) continue;
    if (tip.lat == null || tip.lng == null) continue;
    const dist = haversineMiles(userLocation.lat, userLocation.lng, tip.lat, tip.lng);
    if (dist <= radiusMiles && dist < closestDist) {
      closest = tip;
      closestDist = dist;
    }
  }
  return closest;
}
