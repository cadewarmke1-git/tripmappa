/** Targeted name resolution at GPS — small-radius Nearby (corridor-cached) then Place Details. */
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { nearbySearchCached } from "./placesCorridor.js";
import { fetchPlaceDetailsCached } from "./placesDetailsCache.js";
import { readOsmPlaceIdMap, writeOsmPlaceIdMap } from "./osmPlaceIdMap.js";

const RESOLVE_RADII_M = [80, 150, 300];

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

function detailsFromNearbyPlace(place) {
  if (!place?.placeId || !place?.name) return null;
  return {
    placeId: place.placeId,
    name: place.name,
    photoReference: null,
    rating: place.rating ?? null,
    priceLevel: place.priceLevel ?? null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    types: Array.isArray(place.types) ? place.types : [],
    vicinity: place.address || null,
  };
}

async function detailsForPlaceId(apiKey, placeId, { skipPhotos = false } = {}) {
  return fetchPlaceDetailsCached(apiKey, placeId, { skipPhotos });
}

/**
 * Resolve a real business name at exact coordinates via Nearby (tight radius) + Details cache.
 * When placeId is already known, skips Nearby and goes straight to Details.
 * When skipPhotos is set (preferFallback cards), uses Nearby fields when sufficient and
 * omits Places Photo fields from Details — display name/rating unchanged.
 *
 * @returns {{ details: object|null, cached: boolean, nearbyUsed: boolean, nearbyCallsBilled: number, osmMapHit: boolean, detailsSkipped: boolean }}
 */
export async function resolvePlaceAtLocation(apiKey, lat, lng, {
  type = null,
  keyword = null,
  osmId = null,
  placeId = null,
  skipPhotos = false,
  admin = null,
} = {}) {
  const latNum = lat == null || lat === "" ? NaN : Number(lat);
  const lngNum = lng == null || lng === "" ? NaN : Number(lng);
  const knownPlaceId = placeId != null ? String(placeId).trim() : "";

  if (!apiKey) {
    return {
      details: null,
      cached: false,
      nearbyUsed: false,
      nearbyCallsBilled: 0,
      osmMapHit: false,
      detailsSkipped: false,
    };
  }

  // Known place_id — Details only (no Nearby). Used after prior resolve / OSM map.
  if (knownPlaceId) {
    const { details, cached } = await detailsForPlaceId(apiKey, knownPlaceId, { skipPhotos });
    if (details?.name) {
      if (osmId) {
        const db = admin || getSupabaseAdmin();
        if (db) await writeOsmPlaceIdMap(db, osmId, details.placeId);
      }
      return {
        details,
        cached: cached === true,
        nearbyUsed: false,
        nearbyCallsBilled: 0,
        osmMapHit: false,
        detailsSkipped: false,
      };
    }
  }

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return {
      details: null,
      cached: false,
      nearbyUsed: false,
      nearbyCallsBilled: 0,
      osmMapHit: false,
      detailsSkipped: false,
    };
  }

  const db = admin || getSupabaseAdmin();
  let nearbyCallsBilled = 0;

  if (osmId && db) {
    const mapped = await readOsmPlaceIdMap(db, osmId);
    if (mapped?.placeId) {
      const { details, cached } = await detailsForPlaceId(apiKey, mapped.placeId, { skipPhotos });
      if (details?.name) {
        return {
          details,
          cached: cached === true,
          nearbyUsed: false,
          nearbyCallsBilled: 0,
          osmMapHit: true,
          detailsSkipped: false,
        };
      }
      // Stale place_id — fall through to Nearby resolve and refresh the map.
    }
  }

  for (const radius of RESOLVE_RADII_M) {
    const { places, cached } = await nearbySearchCached(db, apiKey, {
      lat: latNum,
      lng: lngNum,
      type: type || "",
      keyword: keyword || "",
      radius,
      maxResults: 12,
    });
    if (!cached) nearbyCallsBilled += 1;

    const best = pickClosestNamed(places || [], latNum, lngNum, radius);
    if (!best?.placeId) continue;

    // preferFallback cards: Nearby already has name + rating — skip Details/Photo.
    // If rating is missing, fall through to Details (no photos) so card quality is unchanged.
    if (skipPhotos) {
      const fromNearby = detailsFromNearbyPlace(best);
      if (fromNearby?.name && fromNearby.rating != null) {
        if (osmId && db) await writeOsmPlaceIdMap(db, osmId, fromNearby.placeId);
        return {
          details: fromNearby,
          cached: cached === true,
          nearbyUsed: true,
          nearbyCallsBilled,
          osmMapHit: false,
          detailsSkipped: true,
        };
      }
    }

    const { details, cached: detailsCached } = await detailsForPlaceId(apiKey, best.placeId, {
      skipPhotos,
    });
    if (details?.name) {
      if (osmId && db) await writeOsmPlaceIdMap(db, osmId, details.placeId);
      return {
        details,
        cached: detailsCached === true,
        nearbyUsed: true,
        nearbyCallsBilled,
        osmMapHit: false,
        detailsSkipped: false,
      };
    }
  }

  return {
    details: null,
    cached: false,
    nearbyUsed: true,
    nearbyCallsBilled,
    osmMapHit: false,
    detailsSkipped: false,
  };
}

export { RESOLVE_RADII_M };
