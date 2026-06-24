import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Targeted name resolution at GPS via /api/places-resolve. */
export async function resolvePlaceAtLocation({ lat, lng, type = null, keyword = null } = {}) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { details: null, cached: false, nearbyUsed: false, error: "invalid-coords" };
  }

  try {
    const res = await fetch("/api/places-resolve", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ lat: latNum, lng: lngNum, type, keyword }),
    });
    if (!res.ok) {
      return { details: null, cached: false, nearbyUsed: false, error: "failed" };
    }
    const data = await res.json();
    return {
      details: data.details || null,
      cached: data.cached === true,
      nearbyUsed: data.nearbyUsed === true,
      error: null,
    };
  } catch {
    return { details: null, cached: false, nearbyUsed: false, error: "failed" };
  }
}
