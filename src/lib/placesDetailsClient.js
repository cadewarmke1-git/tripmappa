import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Cached Place Details via /api/places-details (Supabase-backed, 7-day TTL). */
export async function fetchPlaceDetailsCached(placeId) {
  const id = String(placeId || "").trim();
  if (!id) return { details: null, cached: false, error: "missing-place-id" };

  try {
    const res = await fetch("/api/places-details", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ placeId: id }),
    });
    if (!res.ok) {
      return { details: null, cached: false, error: res.status === 400 ? "invalid-request" : "failed" };
    }
    const data = await res.json();
    return {
      details: data.details || null,
      cached: data.cached === true,
      error: null,
    };
  } catch {
    return { details: null, cached: false, error: "failed" };
  }
}
