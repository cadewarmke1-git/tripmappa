/** Optimize multi-stop route order via serverless Directions API. */
import { MULTI_VEHICLE_TRIP } from "./vehicles.js";

export function shouldOptimizeRoute(answers, stops = []) {
  if (answers?.trip_type === MULTI_VEHICLE_TRIP || answers?.vehicle === MULTI_VEHICLE_TRIP) return true;
  const overnight = stops.filter(s => s.city && (s.lat != null || s.city));
  return overnight.length >= 2;
}

export async function optimizeStopOrder(origin, destination, stops) {
  if (!origin || !destination) return { stops, optimized: false };

  const withCoords = stops.filter(s => (s.lat != null && s.lng != null) || s.city);
  if (withCoords.length < 2) return { stops, optimized: false };

  try {
    const res = await fetch("/api/route-optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, stops }),
    });
    if (!res.ok) return { stops, optimized: false };
    const data = await res.json();
    return {
      stops: data.stops || stops,
      optimized: !!data.optimized,
    };
  } catch {
    return { stops, optimized: false };
  }
}
