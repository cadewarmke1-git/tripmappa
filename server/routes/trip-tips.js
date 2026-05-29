/** Live Trip Tips — weather conditions and traffic along the route. */
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { cacheGet, cacheSet, cacheThrough, roundCoord } from "../lib/apiCache.js";

const CURRENT_URL = "https://weather.googleapis.com/v1/currentConditions:lookup";
const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const TRAFFIC_BUCKET_MS = 10 * 60 * 1000;
const WEATHER_TTL = 10 * 60 * 1000;
const TRIP_TIPS_TTL = 8 * 60 * 1000;

function sampleRoutePoints(routePoints, max = 4) {
  if (!routePoints?.length) return [];
  if (routePoints.length <= max) return routePoints;
  const out = [];
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i / Math.max(1, max - 1)) * (routePoints.length - 1));
    out.push(routePoints[idx]);
  }
  return out;
}

async function fetchWeatherTip(lat, lng, key) {
  const cacheKey = `weather-tip:${roundCoord(lat)}:${roundCoord(lng)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${CURRENT_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: { latitude: lat, longitude: lng } }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tempC = data?.temperature?.degrees ?? data?.temperature?.value;
  const tempF = tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;
  const condition = data?.weatherCondition?.description
    || data?.weatherCondition?.type
    || data?.condition
    || null;
  if (!condition && tempF == null) return null;
  const parts = [];
  if (tempF != null) parts.push(`${tempF}F`);
  if (condition) parts.push(String(condition).replace(/_/g, " ").toLowerCase());
  const precip = data?.precipitation?.probability?.percent ?? data?.precipitation?.type;
  if (precip != null && typeof precip === "number" && precip >= 50) {
    parts.push(`${precip}% precipitation chance`);
  }
  const tip = `Weather along route: ${parts.join(", ")}`;
  cacheSet(cacheKey, tip, WEATHER_TTL);
  return tip;
}

async function fetchTrafficTips(origin, destination, waypoints, key) {
  const bucket = Math.floor(Date.now() / TRAFFIC_BUCKET_MS);
  const wp = waypoints.slice(0, 4).map(w => `${roundCoord(w.lat)},${roundCoord(w.lng)}`).join("|");
  const cacheKey = `traffic-tips:${origin}:${destination}:${wp}:${bucket}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    key,
    origin,
    destination,
    mode: "driving",
    departure_time: String(Math.floor(Date.now() / 1000)),
    traffic_model: "best_guess",
  });
  if (waypoints?.length) {
    params.set("waypoints", waypoints.map(w => `${w.lat},${w.lng}`).join("|"));
  }

  const res = await fetch(`${DIRECTIONS_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.routes?.length) {
    cacheSet(cacheKey, [], 2 * 60 * 1000);
    return [];
  }

  const tips = [];
  const route = data.routes[0];
  const leg = route.legs?.[0];
  if (leg) {
    const durationSec = leg.duration?.value;
    const durationTrafficSec = leg.duration_in_traffic?.value;
    if (durationSec && durationTrafficSec && durationTrafficSec > durationSec + 600) {
      const delayMin = Math.round((durationTrafficSec - durationSec) / 60);
      tips.push(`Traffic delay: about ${delayMin} min longer than usual due to current conditions`);
    }
    leg.steps?.forEach((step) => {
      const html = step.html_instructions || "";
      if (/closure|closed|blocked|detour|construction|incident|accident/i.test(html)) {
        const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (plain && !tips.some(t => t.includes(plain.slice(0, 40)))) {
          tips.push(plain.length > 120 ? `${plain.slice(0, 117)}...` : plain);
        }
      }
    });
  }

  if (route.warnings?.length) {
    route.warnings.forEach((w) => {
      const text = String(w).trim();
      if (text && !tips.includes(text)) tips.push(text);
    });
  }

  cacheSet(cacheKey, tips, TRIP_TIPS_TTL);
  return tips;
}

function buildTripTipsCacheKey(origin, destination, waypoints) {
  const bucket = Math.floor(Date.now() / TRAFFIC_BUCKET_MS);
  const wp = waypoints.slice(0, 4).map(w => `${roundCoord(w.lat)},${roundCoord(w.lng)}`).join("|");
  return `trip-tips:v1:${origin}:${destination}:${wp}:${bucket}`;
}

async function buildTripTips(origin, destination, routePoints, waypoints, key) {
  const tips = [];
  const seen = new Set();
  const addTip = (line) => {
    const text = String(line || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    tips.push(text);
  };

  const samples = sampleRoutePoints(routePoints, 4);
  const weatherSamples = samples.length ? samples : waypoints.slice(0, 3);
  const weatherResults = await Promise.all(
    weatherSamples.slice(0, 3).map(pt => fetchWeatherTip(pt.lat, pt.lng, key)),
  );
  weatherResults.filter(Boolean).forEach(addTip);

  const trafficTips = await fetchTrafficTips(origin, destination, waypoints, key);
  trafficTips.forEach(addTip);

  return tips.slice(0, 5);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { origin, destination, routePoints = [], waypoints = [] } = req.body || {};
  if (!origin || !destination) {
    return res.status(400).json({ error: "origin and destination are required" });
  }

  try {
    const cacheKey = buildTripTipsCacheKey(origin, destination, waypoints);
    const { value: tips, cached } = await cacheThrough(
      cacheKey,
      TRIP_TIPS_TTL,
      () => buildTripTips(origin, destination, routePoints, waypoints, key),
    );

    return res.status(200).json({
      tips: tips || [],
      updatedAt: Date.now(),
      cached,
    });
  } catch (err) {
    console.error("trip-tips API error:", err);
    return res.status(500).json({ error: "Failed to fetch trip tips" });
  }
}
