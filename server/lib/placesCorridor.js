/** Corridor Places nearby cache — grid keys and TTL (mirrors rest_stop_cache pattern). */

const GRID_DEG = 0.05;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function roundCorridorCoord(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / GRID_DEG) * GRID_DEG;
}

export function corridorCacheKey({ lat, lng, type = "", keyword = "", radius = 1609 } = {}) {
  const rLat = roundCorridorCoord(lat);
  const rLng = roundCorridorCoord(lng);
  if (rLat == null || rLng == null) return null;
  const t = String(type || "").trim().slice(0, 40);
  const k = String(keyword || "").trim().toLowerCase().slice(0, 80);
  const r = Math.round(Number(radius) || 1609);
  return `${rLat}:${rLng}:${t}:${k}:${r}`;
}

export function cacheExpiresBefore() {
  return new Date(Date.now() - CACHE_TTL_MS).toISOString();
}

export const PLACE_DETAIL_FIELDS = "name,geometry,photos,rating,price_level,place_id";

export function mapNearbyResult(place, originLat, originLng) {
  const lat = place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const photoRef = place.photos?.[0]?.photo_reference || null;
  return {
    id: place.place_id || `p-${lat}-${lng}`,
    placeId: place.place_id,
    name: place.name || "Place",
    address: place.vicinity || place.formatted_address || "",
    lat,
    lng,
    rating: place.rating ?? null,
    userRatingsTotal: place.user_ratings_total ?? null,
    priceLevel: place.price_level ?? null,
    types: place.types || [],
    photoReference: photoRef,
    category: "poi",
  };
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

export async function readPlacesCorridorCache(admin, cacheKey) {
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("places_corridor_cache")
      .select("places, cached_at")
      .eq("cache_key", cacheKey)
      .gte("cached_at", cacheExpiresBefore())
      .maybeSingle();
    if (error) {
      console.warn("places_corridor_cache read:", error.message);
      return null;
    }
    if (!data?.places) return null;
    return Array.isArray(data.places) ? data.places : [];
  } catch (err) {
    console.warn("places_corridor_cache read failed:", err.message);
    return null;
  }
}

export async function writePlacesCorridorCache(admin, cacheKey, row, places) {
  if (!admin) return;
  try {
    const { error } = await admin
      .from("places_corridor_cache")
      .upsert({
        cache_key: cacheKey,
        lat: row.lat,
        lng: row.lng,
        search_type: row.type || null,
        keyword: row.keyword || null,
        radius_m: row.radius,
        places,
        cached_at: new Date().toISOString(),
      }, { onConflict: "cache_key" });
    if (error) console.warn("places_corridor_cache write:", error.message);
  } catch (err) {
    console.warn("places_corridor_cache write failed:", err.message);
  }
}

export async function fetchGoogleNearbyRaw({ lat, lng, type, keyword, radius }, apiKey) {
  if (!apiKey) return { places: [], apiError: "no_key" };

  const params = new URLSearchParams({
    key: apiKey,
    location: `${lat},${lng}`,
    radius: String(Math.round(radius)),
  });
  if (type) params.set("type", type);
  if (keyword) params.set("keyword", keyword);

  const res = await fetch(`${NEARBY_URL}?${params}`);
  if (!res.ok) return { places: [], apiError: `http_${res.status}` };
  const data = await res.json();
  if (data.status === "OK" || data.status === "ZERO_RESULTS") {
    return { places: data.results || [], apiError: null };
  }
  console.warn("Places nearby search status:", data.status, data.error_message || "");
  return { places: [], apiError: data.status || "places_error" };
}

/** Shared Supabase-backed Nearby Search (7-day grid-keyed TTL). */
export async function nearbySearchCached(admin, apiKey, {
  lat,
  lng,
  type = "",
  keyword = "",
  radius = 1609,
  maxResults = 12,
} = {}) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const searchRow = {
    lat: latNum,
    lng: lngNum,
    type: type || "",
    keyword: keyword || "",
    radius: Math.round(Number(radius) || 1609),
  };
  const cacheKey = corridorCacheKey(searchRow);
  if (!cacheKey) return { places: [], cached: false, apiError: "invalid_coords" };

  const cached = await readPlacesCorridorCache(admin, cacheKey);
  if (cached) {
    return {
      places: attachDistanceMiles(cached, latNum, lngNum).slice(0, maxResults),
      cached: true,
      apiError: null,
    };
  }

  const { places: raw, apiError } = await fetchGoogleNearbyRaw(searchRow, apiKey);
  if (apiError) return { places: [], cached: false, apiError };

  const mapped = raw
    .map(p => mapNearbyResult(p, latNum, lngNum))
    .filter(Boolean)
    .slice(0, Math.max(maxResults, 12));

  await writePlacesCorridorCache(admin, cacheKey, searchRow, mapped);

  return {
    places: attachDistanceMiles(mapped, latNum, lngNum).slice(0, maxResults),
    cached: false,
    apiError: null,
  };
}


export function attachDistanceMiles(places, originLat, originLng) {
  return (places || []).map(p => ({
    ...p,
    distanceMiles: Math.round(haversineMiles(originLat, originLng, p.lat, p.lng) * 10) / 10,
  }));
}
