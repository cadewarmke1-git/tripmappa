/** Google Places — restaurant search near a route stop with preference filtering. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey, photoUrl } from "../lib/googleKey.js";
import { cacheGet, cacheSet, roundCoord } from "../lib/apiCache.js";
import { getDietarySearchKeywords } from "../lib/dietaryKeywords.js";
import {
  filterByPreferences,
  priceSigns,
  cuisineFromTypes,
  descriptionFromTypes,
  haversineMiles,
} from "../lib/restaurantPreferences.js";

const NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

async function nearbyRestaurants(lat, lng, keyword = "restaurant") {
  const key = getGoogleMapsKey();
  if (!key) return { results: [], apiError: "no_key" };

  async function runSearch(searchKeyword) {
    const params = new URLSearchParams({
      key,
      location: `${lat},${lng}`,
      radius: "8047",
      type: "restaurant",
    });
    if (searchKeyword) params.set("keyword", searchKeyword);

    const res = await fetch(`${NEARBY_URL}?${params}`);
    if (!res.ok) return { results: [], apiError: `http_${res.status}` };
    const data = await res.json();
    if (data.status === "OK" || data.status === "ZERO_RESULTS") {
      return { results: data.results || [], apiError: null };
    }
    console.warn("Places nearby search status:", data.status, data.error_message || "");
    return { results: [], apiError: data.status || "places_error" };
  }

  const cacheKey = `restaurants-nearby:${roundCoord(lat)}:${roundCoord(lng)}:${keyword || "default"}`;
  const cached = cacheGet(cacheKey);
  if (cached && !cached.apiError) return cached;

  let value = await runSearch(keyword);
  if (value.apiError && keyword) {
    value = await runSearch(null);
  }
  if (!value.apiError) cacheSet(cacheKey, value, 12 * 60 * 1000);
  return value;
}

async function fetchDetails(placeId) {
  const key = getGoogleMapsKey();
  if (!key || !placeId) return null;

  const params = new URLSearchParams({
    key,
    place_id: placeId,
    fields: "name,formatted_address,geometry,rating,user_ratings_total,price_level,types,opening_hours,photos,url,website,vicinity,current_opening_hours",
  });

  const res = await fetch(`${DETAILS_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK") return null;
  return data.result;
}

function mapRestaurant(place, details, originLat, originLng, city) {
  const lat = details?.geometry?.location?.lat ?? place.geometry?.location?.lat;
  const lng = details?.geometry?.location?.lng ?? place.geometry?.location?.lng;
  const name = details?.name || place.name;
  const types = details?.types || place.types || [];
  const priceLevel = details?.price_level ?? place.price_level ?? null;
  const photoRef = details?.photos?.[0]?.photo_reference || place.photos?.[0]?.photo_reference;

  return {
    placeId: place.place_id,
    name,
    address: details?.formatted_address || place.vicinity || city || "",
    rating: details?.rating ?? place.rating ?? null,
    userRatingsTotal: details?.user_ratings_total ?? place.user_ratings_total ?? 0,
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
      : null,
    googleMapsUrl: details?.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
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
    const searchTerms = roadStop
      ? ["fast food casual dining"]
      : (dietaryKeywords.length ? dietaryKeywords.slice(0, 4) : ["restaurant"]);

    const rawById = new Map();
    const termErrors = [];
    for (const term of searchTerms) {
      const nearby = await nearbyRestaurants(latNum, lngNum, term);
      if (nearby.apiError === "no_key") {
        return res.status(503).json({ error: "Google Maps API key not configured" });
      }
      if (nearby.apiError) {
        termErrors.push(nearby.apiError);
        continue;
      }
      (nearby.results || []).forEach(p => {
        if (p.place_id) rawById.set(p.place_id, p);
      });
    }
    if (rawById.size === 0 && termErrors.length === searchTerms.length) {
      return res.status(502).json({
        error: "Places API request failed",
        status: termErrors[termErrors.length - 1],
      });
    }

    const raw = [...rawById.values()];
    const seen = new Set();
    const unique = raw.filter(p => {
      if (!p.place_id || seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    }).slice(0, 12);

    const detailed = await Promise.all(
      unique.slice(0, 10).map(async (place) => {
        try {
          const details = await fetchDetails(place.place_id);
          return mapRestaurant(place, details, latNum, lngNum, city);
        } catch (detailErr) {
          console.warn("restaurant details fetch failed:", place.place_id, detailErr.message);
          return mapRestaurant(place, null, latNum, lngNum, city);
        }
      }),
    );

    const filtered = filterByPreferences(detailed.filter(Boolean), answers, { roadStop });
    const pool = filtered.length ? filtered : detailed.filter(Boolean);
    const sorted = pool
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.userRatingsTotal ?? 0) - (a.userRatingsTotal ?? 0))
      .slice(0, limit);

    return res.status(200).json({ restaurants: sorted, city: city || null, empty: sorted.length === 0 });
  } catch (err) {
    console.error("restaurants API error:", err);
    return res.status(500).json({ error: "Failed to fetch restaurants" });
  }
}
