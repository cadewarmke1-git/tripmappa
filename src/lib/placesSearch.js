/** Extended Google Places searches for trip planning and results. */
import { getDietarySearchKeywords, getLoyaltyKeyword, needsWheelchairFilter, asArray, needsSafeStopsOnly } from "./tripAccommodations.js";
import { applyStopFilters, filterLodgingByBudget, filterSafeStopsOnly } from "./placesFilters.js";

const RADIUS_1MI = 1609;
const RADIUS_2MI = 3219;
const RADIUS_5MI = 8047;
const RADIUS_10MI = 16093;

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

function nearbySearch(request) {
  return new Promise((resolve) => {
    const service = getPlaceService();
    if (!service) { resolve([]); return; }
    service.nearbySearch(request, (results, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });
}

function textSearch(request) {
  return new Promise((resolve) => {
    const service = getPlaceService();
    if (!service) { resolve([]); return; }
    service.textSearch(request, (results, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });
}

function getPlaceDetails(placeId) {
  return new Promise((resolve) => {
    const service = getPlaceService();
    if (!service || !placeId) { resolve(null); return; }
    service.getDetails({
      placeId,
      fields: ["name", "formatted_address", "formatted_phone_number", "website", "opening_hours", "rating", "user_ratings_total", "price_level", "photos", "url", "geometry"],
    }, (place, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK) { resolve(null); return; }
      resolve(place);
    });
  });
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
    photoUrl: place.photos?.[0]?.getUrl?.({ maxWidth: 400 }),
  };
}

async function enrichPlaces(places) {
  const top = places.slice(0, 5);
  return Promise.all(top.map(async (p) => {
    if (!p.placeId) return p;
    const details = await getPlaceDetails(p.placeId);
    if (!details) return p;
    return {
      ...p,
      phone: details.formatted_phone_number,
      website: details.website,
      hours: details.opening_hours?.weekday_text?.join("; "),
      bookUrl: details.website || details.url,
      photoUrl: p.photoUrl || details.photos?.[0]?.getUrl?.({ maxWidth: 400 }),
    };
  }));
}

export async function searchNearbyCategory(lat, lng, { type, keyword, radius = RADIUS_5MI, maxResults = 8, wheelchair = false } = {}) {
  if (lat == null || lng == null) return [];
  const location = new window.google.maps.LatLng(lat, lng);
  const req = { location, radius };
  if (type) req.type = type;
  if (keyword) req.keyword = keyword;
  let results = await nearbySearch(req);
  if (wheelchair) {
    results = results.filter(p => p.business_status !== "CLOSED_PERMANENTLY");
  }
  return results.slice(0, maxResults).map(p => mapPlace(p, lat, lng, type || keyword || "poi"));
}

export async function searchRestaurants(lat, lng, answers, { maxDetourMiles = 5, nightOnly = false } = {}) {
  const keywords = getDietarySearchKeywords(answers);
  const remoteWork = asArray(answers?.stops_interests).some(i => /remote work|wifi/i.test(i));
  const keyword = remoteWork ? "cafe wifi laptop" : (keywords[0] || "restaurant");
  let onRoute = await searchNearbyCategory(lat, lng, { type: "restaurant", keyword, radius: RADIUS_1MI, maxResults: 6 });
  let detour = await searchNearbyCategory(lat, lng, { type: "restaurant", keyword, radius: RADIUS_5MI, maxResults: 10 });
  onRoute = applyStopFilters(onRoute, answers, { nightOnly });
  detour = applyStopFilters(detour, answers, { nightOnly });
  const onRouteIds = new Set(onRoute.map(r => r.placeId));
  const detourOnly = detour
    .filter(r => !onRouteIds.has(r.placeId) && (r.rating ?? 0) >= 4.5 && (r.distanceMiles ?? 99) <= maxDetourMiles)
    .map(r => ({ ...r, isDetour: true, detourMiles: r.distanceMiles }));
  const merged = [...onRoute.map(r => ({ ...r, isDetour: false })), ...detourOnly];
  const enriched = await enrichPlaces(merged);
  return enriched.map(r => ({
    ...r,
    wifiAvailable: remoteWork || /wifi|coffee|cafe|starbucks|panera|library/i.test(`${r.name} ${r.address}`),
  }));
}

export async function searchLodging(lat, lng, answers, routeInfo = null) {
  const loyalty = getLoyaltyKeyword(answers);
  const lodging = answers?.lodging || "";
  let keyword = "hotel";
  if (lodging.includes("Camping")) keyword = "campground";
  else if (lodging.includes("Airbnb")) keyword = "vacation rental";
  else if (loyalty) keyword = `${loyalty} hotel`;
  let results = await searchNearbyCategory(lat, lng, {
    type: lodging.includes("Camping") ? "campground" : "lodging",
    keyword,
    radius: RADIUS_5MI,
    maxResults: 12,
    wheelchair: needsWheelchairFilter(answers),
  });
  if (needsSafeStopsOnly(answers)) {
    const safe = filterSafeStopsOnly(results);
    if (safe.length) results = safe;
  }
  results = filterLodgingByBudget(results, answers, routeInfo || {});
  return enrichPlaces(results);
}

export async function searchNearbyServices(lat, lng, categories) {
  const out = {};
  await Promise.all(categories.map(async (cat) => {
    const items = await searchNearbyCategory(lat, lng, {
      type: cat.type,
      keyword: cat.keyword,
      radius: RADIUS_10MI,
      maxResults: 3,
    });
    out[cat.id] = await enrichPlaces(items);
  }));
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
  };
  const cfg = map[interest] || { keyword: interest };
  return enrichPlaces(await searchNearbyCategory(lat, lng, {
    type: cfg.type || "point_of_interest",
    keyword: cfg.keyword || interest,
    radius: cfg.radius || radius,
    maxResults: 5,
  }));
}

export { getPlaceDetails, geocodeCity as geocodeAddress, RADIUS_1MI, RADIUS_2MI, RADIUS_5MI, RADIUS_10MI };
