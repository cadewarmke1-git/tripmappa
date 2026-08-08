import { tripMappaApiHeaders } from "./tripmappaHeaders.js";
import { recordNearbyCalls } from "./placesBudget.js";

/** Targeted name resolution at GPS via /api/places-resolve. */
export async function resolvePlaceAtLocation({
  lat,
  lng,
  type = null,
  keyword = null,
  osmId = null,
  placeId = null,
  skipPhotos = false,
} = {}) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const knownId = placeId != null ? String(placeId).trim() : "";
  if (!knownId && (!Number.isFinite(latNum) || !Number.isFinite(lngNum))) {
    return {
      details: null,
      cached: false,
      nearbyUsed: false,
      nearbyCallsBilled: 0,
      osmMapHit: false,
      detailsSkipped: false,
      error: "invalid-coords",
    };
  }

  try {
    const res = await fetch("/api/places-resolve", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        lat: Number.isFinite(latNum) ? latNum : null,
        lng: Number.isFinite(lngNum) ? lngNum : null,
        type,
        keyword,
        osmId: osmId || null,
        placeId: knownId || null,
        skipPhotos: skipPhotos === true,
      }),
    });
    if (!res.ok) {
      return {
        details: null,
        cached: false,
        nearbyUsed: false,
        nearbyCallsBilled: 0,
        osmMapHit: false,
        detailsSkipped: false,
        error: "failed",
      };
    }
    const data = await res.json();
    const nearbyCallsBilled = Math.max(0, Number(data.nearbyCallsBilled) || 0);
    // Count server-side live Nearby against the per-trip budget (cache hits bill 0).
    // Do not gate resolve on the budget — display quality must not change.
    if (nearbyCallsBilled > 0) recordNearbyCalls(nearbyCallsBilled);
    return {
      details: data.details || null,
      cached: data.cached === true,
      nearbyUsed: data.nearbyUsed === true,
      nearbyCallsBilled,
      osmMapHit: data.osmMapHit === true,
      detailsSkipped: data.detailsSkipped === true,
      error: null,
    };
  } catch {
    return {
      details: null,
      cached: false,
      nearbyUsed: false,
      nearbyCallsBilled: 0,
      osmMapHit: false,
      detailsSkipped: false,
      error: "failed",
    };
  }
}
