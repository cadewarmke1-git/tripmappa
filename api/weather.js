/** Google Weather API — conditions for overnight stop cities. */
import { getGoogleMapsKey } from "./lib/googleKey.js";

const CURRENT_URL = "https://weather.googleapis.com/v1/currentConditions:lookup";
const FORECAST_URL = "https://weather.googleapis.com/v1/forecast/days:lookup";

const WEATHER_ICONS = {
  CLEAR: "☀️",
  MOSTLY_CLEAR: "🌤️",
  PARTLY_CLOUDY: "⛅",
  CLOUDY: "☁️",
  RAIN: "🌧️",
  LIGHT_RAIN: "🌦️",
  HEAVY_RAIN: "🌧️",
  THUNDERSTORM: "⛈️",
  SNOW: "❄️",
  FOG: "🌫️",
  WINDY: "💨",
};

function weatherIcon(conditionType) {
  if (!conditionType) return "🌡️";
  const key = String(conditionType).toUpperCase().replace(/\s+/g, "_");
  for (const [k, icon] of Object.entries(WEATHER_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return "🌡️";
}

function celsiusToF(c) {
  if (c == null) return null;
  return Math.round((c * 9) / 5 + 32);
}

async function fetchCurrent(lat, lng, key) {
  const url = `${CURRENT_URL}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: { latitude: lat, longitude: lng } }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchForecast(lat, lng, key) {
  const url = `${FORECAST_URL}?key=${encodeURIComponent(key)}&days=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: { latitude: lat, longitude: lng } }),
  });
  if (!res.ok) return null;
  return res.json();
}

function mapWeather(city, lat, lng, current, forecast) {
  const tempC = current?.temperature?.degrees ?? current?.temperature?.value;
  const tempF = celsiusToF(tempC);
  const condition = current?.weatherCondition?.type
    || current?.weatherCondition?.description
    || current?.condition
    || "Unknown";
  const precip = forecast?.forecastDays?.[0]?.daytimeForecast?.precipitation?.probability?.percent
    ?? forecast?.forecastDays?.[0]?.precipitation?.probability?.percent
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
    icon: weatherIcon(condition),
    precipitationChance: precip,
    severeWarnings: severe,
    currentlyOpen: null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { stops = [] } = req.body || {};
  if (!Array.isArray(stops) || !stops.length) {
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
