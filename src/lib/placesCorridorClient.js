import { tripMappaApiHeaders } from "./tripmappaHeaders.js";
import { canMakeNearbyCall, recordNearbyCall } from "./placesBudget.js";

/** Cached corridor Nearby Search via /api/places-nearby (Supabase-backed). */
export async function fetchPlacesNearbyCached({
  lat,
  lng,
  type = null,
  keyword = null,
  radius = 1609,
  maxResults = 8,
} = {}) {
  if (lat == null || lng == null) return { places: [], error: "missing-coords" };
  if (!canMakeNearbyCall()) return { places: [], error: "budget-capped", cached: true };

  try {
    const res = await fetch("/api/places-nearby", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ lat, lng, type, keyword, radius, maxResults }),
    });
    if (!res.ok) {
      return { places: [], error: res.status === 400 ? "invalid-request" : "failed" };
    }
    const data = await res.json();
    if (!data.cached) recordNearbyCall();
    return { places: data.places || [], cached: data.cached === true, error: null };
  } catch {
    return { places: [], error: "failed" };
  }
}
