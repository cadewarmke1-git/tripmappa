/** Google Weather API — conditions for overnight stop cities. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import {
  fetchGoogleCurrentConditions,
  fetchGoogleDailyForecast,
  forecastPrecipitationPercent,
  weatherConditionText,
  weatherTemperatureF,
} from "../lib/googleWeather.js";
import { resolveWeatherIconType } from "../lib/weatherIconTypes.js";
import { cacheThrough, roundCoord } from "../lib/apiCache.js";

async function fetchCurrent(lat, lng, key) {
  const cacheKey = `weather-current:${roundCoord(lat)}:${roundCoord(lng)}`;
  const { value } = await cacheThrough(cacheKey, 10 * 60 * 1000, async () =>
    fetchGoogleCurrentConditions(key, lat, lng),
  );
  return value;
}

async function fetchForecast(lat, lng, key) {
  const cacheKey = `weather-forecast:${roundCoord(lat)}:${roundCoord(lng)}`;
  const { value } = await cacheThrough(cacheKey, 30 * 60 * 1000, async () =>
    fetchGoogleDailyForecast(key, lat, lng, 1),
  );
  return value;
}

function mapWeather(city, lat, lng, current, forecast) {
  const tempF = weatherTemperatureF(current);
  const condition = weatherConditionText(current) || "Unknown";
  const precip = forecastPrecipitationPercent(forecast)
    ?? current?.precipitation?.probability?.percent
    ?? null;

  const severe = [];
  const condUpper = String(condition).toUpperCase();
  if (/THUNDER|STORM|HAIL|Tornado|HURRICANE|BLIZZARD|EXTREME|SEVERE|FLOOD|WARNING/i.test(condUpper)) {
    severe.push({ type: condition, message: `${condition} conditions expected` });
  }
  if (precip != null && precip >= 70) {
    severe.push({ type: "High precipitation", message: `${precip}% chance of precipitation` });
  }

  return {
    city,
    lat,
    lng,
    temperatureF: tempF,
    temperatureDisplay: tempF != null ? `${tempF}°F` : "—",
    condition,
    iconType: resolveWeatherIconType(condition),
    precipitationChance: precip,
    severeWarnings: severe,
    currentlyOpen: null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { stops = [] } = req.body || {};
  if (!Array.isArray(stops) || !stops.length || stops.length > 12) {
    return res.status(400).json({ error: "stops array is required" });
  }

  try {
    const results = await Promise.all(
      stops.map(async (stop) => {
        const { lat, lng, city } = stop;
        if (lat == null || lng == null) return null;
        const [current, forecast] = await Promise.all([
          fetchCurrent(lat, lng, key),
          fetchForecast(lat, lng, key),
        ]);
        return mapWeather(city, lat, lng, current, forecast);
      }),
    );

    const weatherByCity = {};
    const severeAlerts = [];

    results.filter(Boolean).forEach(w => {
      weatherByCity[w.city] = w;
      w.severeWarnings.forEach(sw => {
        severeAlerts.push({
          id: `weather-${w.city}-${sw.type}`,
          type: "weather",
          title: `Weather alert — ${w.city}`,
          message: `${sw.message}. Affects your overnight stop in ${w.city.split(",")[0]}.`,
          city: w.city,
        });
      });
    });

    return res.status(200).json({ weatherByCity, severeAlerts });
  } catch (err) {
    console.error("weather API error:", err);
    return res.status(500).json({ error: "Failed to fetch weather" });
  }
}
