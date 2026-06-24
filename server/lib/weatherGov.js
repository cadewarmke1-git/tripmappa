/** National Weather Service (Weather.gov) — no API key required. */

const NWS_BASE = "https://api.weather.gov";
export const NWS_USER_AGENT = "TripMappa/1.0 (https://tripmappa.com, weather@tripmappa.com)";

function nwsHeaders() {
  return {
    Accept: "application/geo+json",
    "User-Agent": NWS_USER_AGENT,
  };
}

async function nwsFetch(url) {
  const res = await fetch(url, { headers: nwsHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("NWS fetch failed:", res.status, url, body.slice(0, 200));
    return null;
  }
  return res.json();
}

function celsiusToF(c) {
  if (c == null || !Number.isFinite(Number(c))) return null;
  return Math.round((Number(c) * 9) / 5 + 32);
}

/** Normalize NWS data to the shape consumed by weatherConditionText / weatherTemperatureF. */
function normalizeCurrentFromHourly(period) {
  if (!period) return null;
  const tempF = period.temperatureUnit === "F"
    ? Math.round(Number(period.temperature))
    : celsiusToF(period.temperature);
  const condition = period.shortForecast || period.detailedForecast || null;
  const precip = period.probabilityOfPrecipitation?.value ?? null;
  return {
    weatherCondition: {
      description: { text: condition },
      type: condition ? String(condition).replace(/\s+/g, "_") : null,
    },
    temperature: tempF != null ? { degrees: tempF, unit: "FAHRENHEIT" } : null,
    precipitation: precip != null ? { probability: { percent: precip } } : null,
  };
}

function normalizeForecastFromPeriod(period) {
  if (!period) return null;
  const precip = period.probabilityOfPrecipitation?.value ?? null;
  return {
    forecastDays: [{
      daytimeForecast: { precipitation: { probability: { percent: precip } } },
      precipitation: { probability: { percent: precip } },
    }],
  };
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

async function resolvePoints(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  const data = await nwsFetch(`${NWS_BASE}/points/${latNum.toFixed(4)},${lngNum.toFixed(4)}`);
  return data?.properties || null;
}

export async function fetchCurrentConditions(_unusedKey, lat, lng) {
  const props = await resolvePoints(lat, lng);
  if (!props?.forecastHourly) return null;
  const hourly = await nwsFetch(props.forecastHourly);
  const period = hourly?.properties?.periods?.[0];
  return normalizeCurrentFromHourly(period);
}

export async function fetchDailyForecast(_unusedKey, lat, lng, _days = 1) {
  const props = await resolvePoints(lat, lng);
  if (!props?.forecast) return null;
  const forecast = await nwsFetch(props.forecast);
  const period = forecast?.properties?.periods?.[0];
  return normalizeForecastFromPeriod(period);
}

export async function fetchActiveAlerts(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return [];
  const data = await nwsFetch(`${NWS_BASE}/alerts/active?point=${latNum.toFixed(4)},${lngNum.toFixed(4)}`);
  const features = data?.features || [];
  return features.map(f => ({
    event: f.properties?.event || "Weather alert",
    headline: f.properties?.headline || f.properties?.description || "",
    severity: f.properties?.severity || null,
  })).filter(a => a.event || a.headline);
}
