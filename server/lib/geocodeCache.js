/** Reverse-geocode cache — grid-keyed lat/lng with 7-day TTL. */
import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { getGoogleMapsKey } from "./googleKey.js";

const GRID_DEG = 0.05;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export function roundGeocodeCoord(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / GRID_DEG) * GRID_DEG;
}

export function geocodeCacheKey(lat, lng) {
  const rLat = roundGeocodeCoord(lat);
  const rLng = roundGeocodeCoord(lng);
  if (rLat == null || rLng == null) return null;
  return `${rLat}:${rLng}`;
}

export function cacheExpiresBefore() {
  return new Date(Date.now() - CACHE_TTL_MS).toISOString();
}

function cityStateFromComponents(components = []) {
  let city = null;
  let state = null;
  for (const component of components) {
    const types = component?.types || [];
    if (!city && (types.includes("locality") || types.includes("administrative_area_level_3"))) {
      city = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      state = component.short_name;
    }
  }
  return city && state ? `${city}, ${state}` : null;
}

async function readGeocodeCache(admin, cacheKey) {
  if (!admin) return null;
  const { data } = await admin
    .from("geocode_cache")
    .select("city_state, formatted_address")
    .eq("cache_key", cacheKey)
    .gte("cached_at", cacheExpiresBefore())
    .maybeSingle();
  return data || null;
}

async function writeGeocodeCache(admin, cacheKey, lat, lng, row) {
  if (!admin) return;
  await admin.from("geocode_cache").upsert({
    cache_key: cacheKey,
    lat,
    lng,
    city_state: row.cityState,
    formatted_address: row.formatted,
    cached_at: new Date().toISOString(),
  }, { onConflict: "cache_key" });
}

export async function reverseGeocodeCached(lat, lng) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

  const cacheKey = geocodeCacheKey(latNum, lngNum);
  if (!cacheKey) return null;

  const admin = getSupabaseAdmin();
  const cached = await readGeocodeCache(admin, cacheKey);
  if (cached) {
    return {
      lat: latNum,
      lng: lngNum,
      cityState: cached.city_state,
      formatted: cached.formatted_address,
      cached: true,
    };
  }

  const key = getGoogleMapsKey();
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    latlng: `${latNum},${lngNum}`,
  });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) return null;

  const result = data.results[0];
  const cityState = cityStateFromComponents(result.address_components || []);
  const row = {
    cityState,
    formatted: result.formatted_address || null,
  };
  await writeGeocodeCache(admin, cacheKey, latNum, lngNum, row);

  return {
    lat: latNum,
    lng: lngNum,
    cityState,
    formatted: row.formatted,
    cached: false,
  };
}
