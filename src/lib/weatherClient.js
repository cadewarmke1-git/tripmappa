import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Client fetch for /api/weather — never throws; empty on failure. */
export async function fetchWeatherForStops(stops) {
  const payload = stops
    .filter(s => s.lat != null && s.lng != null)
    .map((s, i) => ({
      city: s.city || s.id || `pt-${i}`,
      lat: s.lat,
      lng: s.lng,
    }));

  if (!payload.length) return { weatherByCity: {}, severeAlerts: [] };

  try {
    const res = await fetch("/api/weather", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ stops: payload }),
    });

    if (!res.ok) return { weatherByCity: {}, severeAlerts: [] };
    return res.json();
  } catch {
    return { weatherByCity: {}, severeAlerts: [] };
  }
}
