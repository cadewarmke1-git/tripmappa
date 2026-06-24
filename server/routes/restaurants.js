/** Google Places — restaurant search near a route stop; OSM-first with Google gap-fill. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey, photoUrl } from "../lib/googleKey.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { nearbySearchCached } from "../lib/placesCorridor.js";
import { getDietarySearchKeywords } from "../lib/dietaryKeywords.js";
import {
  cacheExpiresBefore,
  corridorBboxCacheKey,
  fetchOverpassCorridorPlaces,
  normalizeBbox,
} from "../lib/corridorOsm.js";
import {
  filterByPreferences,
  priceSigns,
  cuisineFromTypes,
  descriptionFromTypes,
  haversineMiles,
} from "../lib/restaurantPreferences.js";

import {
  detailsResultFromCached,
  fetchPlaceDetailsCached,
} from "../lib/placesDetailsCache.js";
import { resolvePlaceAtLocation } from "../lib/placesResolveAtLocation.js";

function bboxAroundPoint(lat, lng, radiusMi) {
  const degLat = radiusMi / 69;
  const degLng = radiusMi / (Math.max(0.2, Math.cos(lat * Math.PI / 180)) * 69);
  return {
    north: lat + degLat,
    south: lat - degLat,
    east: lng + degLng,
    west: lng - degLng,
  };
}

async function readOsmCorridorCache(admin, cacheKey) {
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("osm_corridor_cache")
      .select("places, cached_at")
      .eq("bbox_key", cacheKey)
      .gte("cached_at", cacheExpiresBefore())
      .maybeSingle();
    if (error || !data?.places) return null;
    return Array.isArray(data.places) ? data.places : [];
  } catch {
    return null;
  }
}

async function writeOsmCorridorCache(admin, cacheKey, bbox, places) {
  if (!admin) return;
  try {
    await admin.from("osm_corridor_cache").upsert({
      bbox_key: cacheKey,
      north: bbox.north,
      south: bbox.south,
      east: bbox.east,
      west: bbox.west,
      places,
      cached_at: new Date().toISOString(),
    }, { onConflict: "bbox_key" });
  } catch {
    // non-fatal
  }
}

async function osmRestaurantsNear(lat, lng, radiusMi = 5) {
  const normalized = normalizeBbox(bboxAroundPoint(lat, lng, radiusMi));
  if (!normalized) return [];

  const admin = getSupabaseAdmin();
  const cacheKey = corridorBboxCacheKey(normalized);
  const cached = await readOsmCorridorCache(admin, cacheKey);
  const places = cached || await fetchOverpassCorridorPlaces(normalized);
  if (!cached) await writeOsmCorridorCache(admin, cacheKey, normalized, places);

  return (places || []).filter(p => p.category === "restaurant");
}

function mapOsmRestaurant(p, originLat, originLng, city) {
  const lat = p.lat;
  const lng = p.lon ?? p.lng;
  return {
    placeId: null,
    osmId: p.id,
    name: p.name,
    address: city || "",
    rating: null,
    userRatingsTotal: 0,
    priceLevel: null,
    price_level: null,
    priceSigns: "",
    cuisineType: "Restaurant",
    photoUrl: null,
    hours: null,
    openNow: null,
    currentlyOpen: null,
    distanceMiles: lat != null && originLat != null
      ? Math.round(haversineMiles(originLat, originLng, lat, lng) * 10) / 10
      : null,
    googleMapsUrl: null,
    description: p.name,
    types: ["restaurant"],
    lat,
    lng,
    city,
    source: "osm",
  };
}

async function nearbyRestaurants(lat, lng, keyword = "restaurant") {
  const key = getGoogleMapsKey();
  if (!key) return { results: [], apiError: "no_key" };

  const admin = getSupabaseAdmin();
  let { places, apiError } = await nearbySearchCached(admin, key, {
    lat,
    lng,
    type: "restaurant",
    keyword: keyword || "",
    radius: 8047,
    maxResults: 20,
  });

  if (apiError && keyword) {
    ({ places, apiError } = await nearbySearchCached(admin, key, {
      lat,
      lng,
      type: "restaurant",
      keyword: "",
      radius: 8047,
      maxResults: 20,
    }));
  }

  if (apiError) return { results: [], apiError };
  return { results: places, apiError: null };
}

async function fetchDetails(placeId, apiKey) {
  if (!placeId) return null;
  const { details, apiError } = await fetchPlaceDetailsCached(apiKey, placeId);
  if (apiError || !details) return null;
  return detailsResultFromCached(details);
}

function mapRestaurant(place, details, originLat, originLng, city) {
  const lat = details?.geometry?.location?.lat ?? place.lat ?? place.geometry?.location?.lat;
  const lng = details?.geometry?.location?.lng ?? place.lng ?? place.geometry?.location?.lng;
  const name = details?.name || place.name;
  const types = details?.types || place.types || [];
  const priceLevel = details?.price_level ?? place.priceLevel ?? place.price_level ?? null;
  const photoRef = details?.photos?.[0]?.photo_reference || place.photoReference || place.photos?.[0]?.photo_reference;
  const placeId = place.placeId || place.place_id;

  return {
    placeId,
    name,
    address: details?.formatted_address || place.address || place.vicinity || city || "",
    rating: details?.rating ?? place.rating ?? null,
    userRatingsTotal: details?.user_ratings_total ?? place.userRatingsTotal ?? place.user_ratings_total ?? 0,
    priceLevel,
    price_level: priceLevel,
    priceSigns: priceSigns(priceLevel),
    cuisineType: cuisineFromTypes(types),
    photoUrl: photoUrl(photoRef, 256),
    hours: details?.opening_hours?.weekday_text?.join("; ")
      || details?.current_opening_hours?.weekday_text?.join("; ")
      || null,
    openNow: details?.opening_hours?.open_now
      ?? details?.current_opening_hours?.open_now
      ?? place.opening_hours?.open_now
      ?? null,
    currentlyOpen: details?.opening_hours?.open_now
      ?? details?.current_opening_hours?.open_now
      ?? place.opening_hours?.open_now
      ?? null,
    distanceMiles: lat != null && originLat != null
      ? Math.round(haversineMiles(originLat, originLng, lat, lng) * 10) / 10
      : place.distanceMiles ?? null,
    googleMapsUrl: details?.url || (placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : null),
    description: descriptionFromTypes(types, name),
    types,
    lat,
    lng,
    city,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { lat, lng, city, answers = {}, limit = 6, roadStop = false } = req.body || {};
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }

  try {
    const dietaryKeywords = getDietarySearchKeywords(answers);
    const osmRaw = await osmRestaurantsNear(latNum, lngNum, roadStop ? 1 : 5);
    const rawById = new Map();
    osmRaw.forEach(p => rawById.set(p.id, mapOsmRestaurant(p, latNum, lngNum, city)));

    if (rawById.size < limit) {
      const combinedKeyword = roadStop
        ? "fast food casual dining"
        : (dietaryKeywords.length ? dietaryKeywords.slice(0, 4).join(" ") : "restaurant");

      const nearby = await nearbyRestaurants(latNum, lngNum, combinedKeyword);
      if (nearby.apiError === "no_key") {
        return res.status(503).json({ error: "Google Maps API key not configured" });
      }
      if (nearby.apiError && rawById.size === 0) {
        return res.status(502).json({
          error: "Places API request failed",
          status: nearby.apiError,
        });
      }
      (nearby.results || []).forEach(p => {
        const id = p.placeId || p.place_id;
        if (id && !rawById.has(id)) rawById.set(id, p);
      });
    }

    if (rawById.size === 0) {
      return res.status(200).json({ restaurants: [], city: city || null, empty: true });
    }

    const raw = [...rawById.values()];
    const seen = new Set();
    const unique = raw.filter(p => {
      const id = p.placeId || p.place_id || p.osmId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 12);

    const basic = unique.map(place => (
      place.source === "osm"
        ? place
        : mapRestaurant(place, null, latNum, lngNum, city)
    ));
    const filtered = filterByPreferences(basic.filter(Boolean), answers, { roadStop });
    const pool = filtered.length ? filtered : basic.filter(Boolean);
    const sorted = pool
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.userRatingsTotal ?? 0) - (a.userRatingsTotal ?? 0))
      .slice(0, limit);

    const withDetails = await Promise.all(
      sorted.map(async (place) => {
        if (place.source === "osm" && !place.placeId) {
          const { details } = await resolvePlaceAtLocation(key, place.lat, place.lng, {
            type: "restaurant",
            keyword: "restaurant",
          });
          if (!details?.name || !details?.placeId) return null;
          const detailShape = detailsResultFromCached(details);
          return mapRestaurant(
            { placeId: details.placeId, lat: place.lat, lng: place.lng },
            detailShape,
            latNum,
            lngNum,
            city,
          );
        }
        if (!place.placeId) return null;
        try {
          const details = await fetchDetails(place.placeId, key);
          const rawPlace = rawById.get(place.placeId);
          const mapped = mapRestaurant(rawPlace || { placeId: place.placeId }, details, latNum, lngNum, city);
          if (!mapped?.name) return null;
          return mapped;
        } catch (detailErr) {
          console.warn("restaurant details fetch failed:", place.placeId, detailErr.message);
          return null;
        }
      }),
    );

    const verified = withDetails.filter(Boolean);
    return res.status(200).json({ restaurants: verified, city: city || null, empty: verified.length === 0 });
  } catch (err) {
    console.error("restaurants API error:", err);
    return res.status(500).json({ error: "Failed to fetch restaurants" });
  }
}
