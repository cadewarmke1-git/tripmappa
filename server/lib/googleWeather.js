/** Google Maps Platform Weather API — GET lookups with query params (not POST). */

const CURRENT_URL = "https://weather.googleapis.com/v1/currentConditions:lookup";
const FORECAST_URL = "https://weather.googleapis.com/v1/forecast/days:lookup";

function buildWeatherUrl(baseUrl, key, lat, lng, extra = {}) {
  const params = new URLSearchParams({
    key,
    "location.latitude": String(lat),
    "location.longitude": String(lng),
    unitsSystem: "IMPERIAL",
    languageCode: "en",
  });
  Object.entries(extra).forEach(([name, value]) => {
    if (value != null) params.set(name, String(value));
  });
  return `${baseUrl}?${params}`;
}

export function weatherConditionText(data) {
  return data?.weatherCondition?.description?.text
    || (data?.weatherCondition?.type
      ? String(data.weatherCondition.type).replace(/_/g, " ")
      : null);
}

export function weatherTemperatureF(data) {
  const degrees = data?.temperature?.degrees;
  if (degrees == null) return null;
  const unit = String(data?.temperature?.unit || "").toUpperCase();
  if (unit.includes("FAHRENHEIT")) return Math.round(degrees);
  return Math.round((degrees * 9) / 5 + 32);
}

export function forecastPrecipitationPercent(forecast) {
  return forecast?.forecastDays?.[0]?.daytimeForecast?.precipitation?.probability?.percent
    ?? forecast?.forecastDays?.[0]?.precipitation?.probability?.percent
    ?? null;
}

export async function fetchGoogleCurrentConditions(key, lat, lng) {
  const url = buildWeatherUrl(CURRENT_URL, key, lat, lng);
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("Google Weather currentConditions:", res.status, body.slice(0, 200));
    return null;
  }
  return res.json();
}

export async function fetchGoogleDailyForecast(key, lat, lng, days = 1) {
  const url = buildWeatherUrl(FORECAST_URL, key, lat, lng, { days });
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("Google Weather forecast:", res.status, body.slice(0, 200));
    return null;
  }
  return res.json();
}
