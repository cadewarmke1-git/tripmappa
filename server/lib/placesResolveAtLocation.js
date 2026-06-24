/** Targeted name resolution at GPS — small-radius Nearby then Place Details (cached). */
import { attachDistanceMiles, fetchGoogleNearbyRaw, mapNearbyResult } from "./placesCorridor.js";
import { fetchPlaceDetailsCached } from "./placesDetailsCache.js";

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickClosestNamed(places, lat, lng, maxMeters) {
  let best = null;
  let bestDist = maxMeters;
  for (const p of places || []) {
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name || name === "Place") continue;
    if (p.lat == null || p.lng == null) continue;
    const dist = haversineMeters(lat, lng, p.lat, p.lng);
    if (dist <= bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}

/**
 * Resolve a real business name at exact coordinates via Nearby (tight radius) + Details cache.
 * @returns {{ details: object|null, cached: boolean, nearbyUsed: boolean }}
 */
export async function resolvePlaceAtLocation(apiKey, lat, lng, { type = null, keyword = null } = {}) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!apiKey || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { details: null, cached: false, nearbyUsed: false };
  }

  for (const radius of [80, 150, 300]) {
    const { places: raw } = await fetchGoogleNearbyRaw({
      lat: latNum,
      lng: lngNum,
      type: type || "",
      keyword: keyword || "",
      radius,
    }, apiKey);

    const mapped = attachDistanceMiles(
      raw.map(p => mapNearbyResult(p, latNum, lngNum)).filter(Boolean),
      latNum,
      lngNum,
    );
    const best = pickClosestNamed(mapped, latNum, lngNum, radius);
    if (!best?.placeId) continue;

    const { details, cached } = await fetchPlaceDetailsCached(apiKey, best.placeId);
    if (details?.name) {
      return { details, cached: cached === true, nearbyUsed: true };
    }
  }

  return { details: null, cached: false, nearbyUsed: true };
}
