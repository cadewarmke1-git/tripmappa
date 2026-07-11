/** Extended Google Places searches for trip planning and results. */
import { fetchPlacesNearbyCached } from "./placesCorridorClient.js";
import {
  canMakeDetailsCall,
  canMakeNearbyCall,
  recordDetailsCall,
  recordNearbyCall,
} from "./placesBudget.js";
import { getDietarySearchKeywords, getLoyaltyKeyword, needsWheelchairFilter, needsWheelchairLodgingFilter, asArray, needsSafeStopsOnly, prefIncludes } from "./tripAccommodations.js";
import { dietaryMatchesRestaurant } from "./dietaryKeywords.js";
import { fetchCorridorOsmForBbox } from "./corridorOsmClient.js";
import { lodgingPlacesFromOsm } from "./osmCorridorPlaces.js";
import { fetchPlaceDetailsCached as fetchPlaceDetailsFromApi } from "./placesDetailsClient.js";
import { ensureNamedEnrichedPlace } from "./osmPlaceEnrichment.js";
import {
  applyStopFilters,
  filterFoodCandidates,
  filterLodgingCandidates,
  filterLodgingByBudget,
  filterSafeStopsOnly,
} from "./placesFilters.js";

const RADIUS_1MI = 1609;
const RADIUS_2MI = 3219;
const RADIUS_5MI = 8047;
const RADIUS_10MI = 16093;

/** Pause between sequential Places API calls to reduce rate-limit bursts. */
export const PLACES_API_CALL_DELAY_MS = 250;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function placesApiDelay() {
  await sleep(PLACES_API_CALL_DELAY_MS);
}

function placesStatus() {
  return window.google?.maps?.places?.PlacesServiceStatus;
}

function isRateLimitedStatus(status) {
  const S = placesStatus();
  return Boolean(S && status === S.OVER_QUERY_LIMIT);
}

async function withPlacesRateLimitRetry(fetchOnce, emptyValue) {
  let backoffMs = 500;
  for (let attempt = 0; attempt <= 2; attempt++) {
    const { value, status } = await fetchOnce();
    if (!isRateLimitedStatus(status)) return value;
    if (attempt === 2) return emptyValue;
    await sleep(backoffMs);
    backoffMs *= 2;
  }
  return emptyValue;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPlaceService() {
  if (!window.google?.maps?.places) return null;
  const container = document.createElement("div");
  return new window.google.maps.places.PlacesService(container);
}

function nearbySearchRaw(request) {
  return new Promise((resolve) => {
    const service = getPlaceService();
    if (!service) {
      resolve({ results: [], status: null });
      return;
    }
    service.nearbySearch(request, (results, status) => {
      resolve({ results: results || [], status });
    });
  });
}

async function nearbySearch(request) {
  const OK = placesStatus()?.OK;
  return withPlacesRateLimitRetry(async () => {
    const { results, status } = await nearbySearchRaw(request);
    if (status === OK && results?.length) return { value: results, status };
    return { value: [], status };
  }, []);
}

function photoUrlFromReference(photoReference, maxWidth = 256) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!photoReference || !key) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${key}`;
}

function mapCachedDetailsToPlace(cached) {
  if (!cached) return null;
  return {
    place_id: cached.placeId,
    name: cached.name,
    rating: cached.rating,
    price_level: cached.priceLevel,
    photos: cached.photoReference
      ? [{ getUrl: ({ maxWidth } = {}) => photoUrlFromReference(cached.photoReference, maxWidth || 256) }]
      : [],
  };
}

async function getPlaceDetails(placeId) {
  if (!placeId) return null;

  const { details, cached, error } = await fetchPlaceDetailsFromApi(placeId);
  if (details) {
    if (!cached) recordDetailsCall();
    return mapCachedDetailsToPlace(details);
  }

  return error ? null : null;
}

function mapPlace(place, originLat, originLng, category = "poi") {
  const lat = place.geometry?.location?.lat?.() ?? place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng?.() ?? place.geometry?.location?.lng;
  const distanceMiles = lat != null && lng != null && originLat != null
    ? Math.round(haversineMiles(originLat, originLng, lat, lng) * 10) / 10
    : null;
  return {
    id: place.place_id || `${category}-${lat}-${lng}`,
    placeId: place.place_id,
    name: place.name || "Place",
    address: place.vicinity || place.formatted_address || "",
    lat,
    lng,
    distanceMiles,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    priceLevel: place.price_level,
    openNow: place.opening_hours?.open_now,
    category,
    types: place.types || [],
    photoUrl: place.photos?.[0]?.getUrl?.({ maxWidth: 256 }),
  };
}

async function enrichSelectedPlaces(places, maxCount = 4) {
  const selected = places.slice(0, maxCount);
  const enriched = [];
  for (const p of selected) {
    if (enriched.length > 0) await placesApiDelay();
    const verified = await ensureNamedEnrichedPlace(p, "lodging");
    if (verified) enriched.push(verified);
  }
  return enriched;
}

export async function searchNearbyCategory(lat, lng, { type, keyword, radius = RADIUS_5MI, maxResults = 8, wheelchair = false } = {}) {
  if (lat == null || lng == null) return [];

  if (canMakeNearbyCall()) {
    const { places, error } = await fetchPlacesNearbyCached({
      lat,
      lng,
      type,
      keyword,
      radius,
      maxResults,
    });

    if (!error) {
      let results = places.map(p => ({
      id: p.id || p.placeId,
      placeId: p.placeId,
      name: p.name || "Place",
      address: p.address || "",
      lat: p.lat,
      lng: p.lng,
      distanceMiles: p.distanceMiles,
      rating: p.rating,
      userRatingsTotal: p.userRatingsTotal,
      priceLevel: p.priceLevel,
      category: type || keyword || "poi",
      types: p.types || [],
      photoUrl: p.photoUrl || null,
    }));
    if (wheelchair) {
      results = results.filter(p => p.business_status !== "CLOSED_PERMANENTLY");
    }
    return results.slice(0, maxResults);
    }
  }

  if (!canMakeNearbyCall()) return [];

  const location = new window.google.maps.LatLng(lat, lng);
  const req = { location, radius };
  if (type) req.type = type;
  if (keyword) req.keyword = keyword;
  let results = await nearbySearch(req);
  recordNearbyCall();
  if (wheelchair) {
    results = results.filter(p => p.business_status !== "CLOSED_PERMANENTLY");
  }
  return results.slice(0, maxResults).map(p => mapPlace(p, lat, lng, type || keyword || "poi"));
}

export async function searchLodging(lat, lng, answers, routeInfo = null) {
  const lodging = answers?.lodging || "";
  const wheelchairLodging = needsWheelchairLodgingFilter(answers);

  if (!lodging.includes("Camping") && !lodging.includes("Airbnb")) {
    const degLat = 5 / 69;
    const degLng = 5 / (Math.max(0.2, Math.cos(lat * Math.PI / 180)) * 69);
    const { places: osmPlaces } = await fetchCorridorOsmForBbox({
      bbox: { north: lat + degLat, south: lat - degLat, east: lng + degLng, west: lng - degLng },
    });
    const osmLodging = lodgingPlacesFromOsm(osmPlaces || [], lat, lng, 5);
    if (osmLodging.length >= 1) {
      let results = osmLodging.map(h => ({
        id: h.osmId || h.name,
        placeId: null,
        name: h.name,
        address: h.address || "",
        lat: h.lat,
        lng: h.lng,
        distanceMiles: h.distanceMi,
        rating: null,
        source: "osm",
        category: "lodging",
      }));
      results = filterLodgingCandidates(results);
      if (needsSafeStopsOnly(answers)) {
        const safe = filterSafeStopsOnly(results);
        if (safe.length) results = safe;
      }
      results = filterLodgingByBudget(results, answers, routeInfo || {});
      const enriched = [];
      for (const h of results.slice(0, 4)) {
        const verified = await ensureNamedEnrichedPlace(h, "lodging");
        if (verified) enriched.push(verified);
      }
      return enriched;
    }
  }

  const loyalty = getLoyaltyKeyword(answers);
  let keyword = "hotel";
  if (lodging.includes("Camping")) keyword = "campground";
  else if (lodging.includes("Airbnb")) keyword = "vacation rental";
  else if (wheelchairLodging) keyword = "wheelchair accessible hotel";
  else if (loyalty) keyword = `${loyalty} hotel`;
  let results = await searchNearbyCategory(lat, lng, {
    type: lodging.includes("Camping") ? "campground" : "lodging",
    keyword,
    radius: RADIUS_5MI,
    maxResults: 12,
    wheelchair: needsWheelchairFilter(answers) || wheelchairLodging,
  });
  results = filterLodgingCandidates(results);
  if (needsSafeStopsOnly(answers)) {
    const safe = filterSafeStopsOnly(results);
    if (safe.length) results = safe;
  }
  results = filterLodgingByBudget(results, answers, routeInfo || {});
  const selected = results.slice(0, 4);
  return enrichSelectedPlaces(selected, 4);
}

export async function searchNearbyServices(lat, lng, categories) {
  const out = {};
  for (const cat of categories) {
    await placesApiDelay();
    const items = await searchNearbyCategory(lat, lng, {
      type: cat.type,
      keyword: cat.keyword,
      radius: RADIUS_10MI,
      maxResults: 3,
    });
    out[cat.id] = items;
  }
  return out;
}

export async function geocodeCity(city) {
  if (!window.google?.maps) return null;
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: city }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) { resolve(null); return; }
      const loc = results[0].geometry.location;
      resolve({ lat: loc.lat(), lng: loc.lng(), formatted: results[0].formatted_address });
    });
  });
}

export async function searchInterestPOIs(lat, lng, interest, radius = RADIUS_10MI) {
  const map = {
    "National Parks or Nature": { keyword: "national park visitor center" },
    Casinos: { keyword: "casino hotel" },
    "Landmarks or Historical Sites": { type: "tourist_attraction", keyword: "historical landmark" },
    Beaches: { keyword: "beach" },
    "Amusement Parks": { keyword: "amusement park" },
    "Kid friendly attractions": { keyword: "zoo aquarium children museum" },
    "Playground or park": { keyword: "playground park", radius: RADIUS_2MI },
    "Live Music Venues": { keyword: "live music venue" },
    "Comedy Clubs or Sports Bars": { keyword: "comedy club sports bar" },
    "Drive-In Movie Theaters": { keyword: "drive in theater" },
    "Antique Shops or Flea Markets": { keyword: "antique flea market" },
    "Remote work — WiFi cafés": { keyword: "cafe wifi laptop" },
    "Prayer facilities": { keyword: "mosque church temple synagogue", radius: RADIUS_2MI },
  };
  const cfg = map[interest] || { keyword: interest };
  return searchNearbyCategory(lat, lng, {
    type: cfg.type || "point_of_interest",
    keyword: cfg.keyword || interest,
    radius: cfg.radius || radius,
    maxResults: 5,
  });
}

export { RADIUS_2MI };
