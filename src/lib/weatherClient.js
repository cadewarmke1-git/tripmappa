import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Client fetch for /api/weather */
export async function fetchWeatherForStops(stops) {
  const payload = stops
    .filter(s => s.city && s.lat != null && s.lng != null)
    .map(s => ({ city: s.city, lat: s.lat, lng: s.lng }));

  if (!payload.length) return { weatherByCity: {}, severeAlerts: [] };

  const res = await fetch("/api/weather", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ stops: payload }),
  });

  if (!res.ok) return { weatherByCity: {}, severeAlerts: [] };
  return res.json();
}
