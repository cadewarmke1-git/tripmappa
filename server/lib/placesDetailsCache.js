/** Google Place Details — Supabase cache keyed by place_id (7-day TTL). */

import { getSupabaseAdmin } from "./supabaseAdmin.js";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

export const PLACE_DETAILS_FIELDS = "name,geometry,photos,rating,price_level,place_id,types,vicinity";

export function cacheExpiresBefore() {
  return new Date(Date.now() - CACHE_TTL_MS).toISOString();
}

export function normalizeDetailsResult(result) {
  if (!result?.place_id) return null;
  const lat = result.geometry?.location?.lat;
  const lng = result.geometry?.location?.lng;
  return {
    placeId: result.place_id,
    name: result.name || null,
    photoReference: result.photos?.[0]?.photo_reference || null,
    rating: result.rating ?? null,
    priceLevel: result.price_level ?? null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    types: Array.isArray(result.types) ? result.types : [],
    vicinity: result.vicinity || null,
  };
}

/** Reconstruct legacy Details JSON shape for restaurant mapping. */
export function detailsResultFromCached(cached) {
  if (!cached) return null;
  return {
    place_id: cached.placeId,
    name: cached.name,
    rating: cached.rating,
    price_level: cached.priceLevel,
    types: cached.types || [],
    vicinity: cached.vicinity,
    photos: cached.photoReference ? [{ photo_reference: cached.photoReference }] : [],
    geometry: (cached.lat != null && cached.lng != null)
      ? { location: { lat: cached.lat, lng: cached.lng } }
      : undefined,
  };
}

async function readCachedDetails(admin, placeId) {
  if (!admin || !placeId) return null;
  try {
    const { data, error } = await admin
      .from("place_details_cache")
      .select("details, cached_at")
      .eq("place_id", placeId)
      .gte("cached_at", cacheExpiresBefore())
      .maybeSingle();
    if (error) {
      console.warn("place_details_cache read:", error.message);
      return null;
    }
    if (!data?.details || typeof data.details !== "object") return null;
    return data.details;
  } catch (err) {
    console.warn("place_details_cache read failed:", err.message);
    return null;
  }
}

async function writeCachedDetails(admin, placeId, details) {
  if (!admin || !placeId || !details) return;
  try {
    const { error } = await admin
      .from("place_details_cache")
      .upsert({
        place_id: placeId,
        details,
        cached_at: new Date().toISOString(),
      }, { onConflict: "place_id" });
    if (error) console.warn("place_details_cache write:", error.message);
  } catch (err) {
    console.warn("place_details_cache write failed:", err.message);
  }
}

async function fetchGooglePlaceDetails(placeId, apiKey, fields = PLACE_DETAILS_FIELDS) {
  if (!apiKey || !placeId) return null;

  const params = new URLSearchParams({
    key: apiKey,
    place_id: placeId,
    fields,
  });

  const res = await fetch(`${DETAILS_URL}?${params}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== "OK" || !data.result) return null;
  return normalizeDetailsResult(data.result);
}

/**
 * Read Place Details from Supabase cache; fetch Google only on miss/expiry.
 * @returns {{ details: object|null, cached: boolean, apiError: string|null }}
 */
export async function fetchPlaceDetailsCached(apiKey, placeId, { fields = PLACE_DETAILS_FIELDS } = {}) {
  const id = String(placeId || "").trim();
  if (!id) return { details: null, cached: false, apiError: "missing_place_id" };

  const admin = getSupabaseAdmin();
  const cached = await readCachedDetails(admin, id);
  if (cached?.placeId) {
    return { details: cached, cached: true, apiError: null };
  }

  if (!apiKey) return { details: null, cached: false, apiError: "no_key" };

  const fresh = await fetchGooglePlaceDetails(id, apiKey, fields);
  if (!fresh) return { details: null, cached: false, apiError: "places_error" };

  await writeCachedDetails(admin, id, fresh);
  return { details: fresh, cached: false, apiError: null };
}
