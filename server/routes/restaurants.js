/** Google Places — restaurant search near a route stop with preference filtering. */
import { getGoogleMapsKey, photoUrl } from "../lib/googleKey.js";
import { cacheThrough, roundCoord } from "../lib/apiCache.js";

const NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json";

const FAST_FOOD_RE = /\b(mcdonald|burger king|wendy|taco bell|kfc|subway|chipotle|panda express|arby|sonic|jack in the box|dairy queen|popeyes|chick-fil-a|five guys|in-n-out|whataburger|culver|zaxby|raising cane|del taco|white castle|hardee|carl's jr|pizza hut|domino|little caesar|papa john|panera|starbucks|dunkin|jamba|smoothie king|bojangles|checkers|rally|steak 'n shake|culver's|qdoba|moe's|jersey mike|firehouse subs|jimmy john|potbelly|noodles|fast food|quick service)\b/i;

const CUISINE_TYPES = {
  american_restaurant: "American",
  barbecue_restaurant: "BBQ",
  chinese_restaurant: "Chinese",
  fast_food_restaurant: "Fast Food",
  french_restaurant: "French",
  greek_restaurant: "Greek",
  hamburger_restaurant: "Burgers",
  indian_restaurant: "Indian",
  italian_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  korean_restaurant: "Korean",
  mexican_restaurant: "Mexican",
  pizza_restaurant: "Pizza",
  seafood_restaurant: "Seafood",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  thai_restaurant: "Thai",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
  meal_takeaway: "Takeout",
  cafe: "Café",
  bakery: "Bakery",
  bar: "Bar & Grill",
  restaurant: "Restaurant",
};

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function priceSigns(level) {
  if (level == null || level < 1) return "$";
  return "$".repeat(Math.min(4, Math.max(1, level)));
}

function cuisineFromTypes(types = []) {
  for (const t of types) {
    if (CUISINE_TYPES[t]) return CUISINE_TYPES[t];
  }
  const food = types.find(t => t.includes("restaurant") || t === "cafe" || t === "bakery");
  if (food) return food.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return "Restaurant";
}

function descriptionFromTypes(types = [], name = "") {
  const cuisine = cuisineFromTypes(types);
  if (/play/i.test(name)) return `${cuisine} with a play area — great for families.`;
  if (types.includes("fast_food_restaurant") || types.includes("meal_takeaway")) {
    return `Quick ${cuisine.toLowerCase()} stop near your route.`;
  }
  if (types.includes("bar")) return `${cuisine} with full menu and drinks.`;
  return `Popular ${cuisine.toLowerCase()} spot with solid reviews nearby.`;
}

function isFastFood(place, name) {
  const types = place.types || [];
  if (types.includes("fast_food_restaurant") || types.includes("meal_takeaway")) return true;
  return FAST_FOOD_RE.test(name);
}

function isSitDown(place, name) {
  const price = place.price_level;
  if (isFastFood(place, name)) return false;
  return price == null || price >= 2;
}

function hasOutdoorSeating(types = [], name = "") {
  return types.includes("bar") || /patio|outdoor|terrace|garden/i.test(name);
}

function hasPlayArea(name = "") {
  return /play\s*area|playground|play place|playland|mcdonald/i.test(name);
}

function prefIncludes(prefs, value) {
  return Array.isArray(prefs) && prefs.includes(value);
}

function filterByPreferences(candidates, answers = {}, { roadStop = false } = {}) {
  const prefs = answers.preferences || [];
  const lodging = answers.lodging || "";
  const accessibility = answers.accessibility || [];
  const youngKids = accessibility.includes("Traveling with young children")
    || (answers.stops_interests || []).some(i => /kid|child|family|playground/i.test(i));

  let list = [...candidates];

  if (roadStop) {
    list = list.filter(p => isFastFood(p, p.name) || (p.price_level ?? 2) <= 2);
  } else if (prefIncludes(prefs, "Fast food only")) {
    list = list.filter(p => isFastFood(p, p.name));
  } else if (prefIncludes(prefs, "Sit down restaurants only")) {
    list = list.filter(p => isSitDown(p, p.name));
  }

  if (lodging === "Luxury" || lodging === "Upscale hotel" || lodging === "Luxury hotel") {
    list.sort((a, b) => (b.price_level ?? 0) - (a.price_level ?? 0));
  } else if (lodging === "Budget" || lodging === "Budget hotel") {
    list.sort((a, b) => (a.price_level ?? 2) - (b.price_level ?? 2));
  }

  return list.map(p => {
    const badges = [];
    if (youngKids && (hasPlayArea(p.name) || /family|kid/i.test(p.name))) {
      badges.push("playArea");
    }
    if (youngKids) badges.push("familyFriendly");
    if (prefIncludes(prefs, "Pet friendly") && hasOutdoorSeating(p.types, p.name)) {
      badges.push("outdoorSeating");
    }
    return { ...p, badges: [...new Set(badges)] };
  });
}

async function nearbyRestaurants(lat, lng, keyword = "restaurant") {
  const key = getGoogleMapsKey();
  if (!key) return [];

  const cacheKey = `restaurants-nearby:${roundCoord(lat)}:${roundCoord(lng)}:${keyword}`;
  const { value } = await cacheThrough(cacheKey, 12 * 60 * 1000, async () => {
    const params = new URLSearchParams({
      key,
      location: `${lat},${lng}`,
      radius: "8047",
      type: "restaurant",
      keyword,
    });

    const res = await fetch(`${NEARBY_URL}?${params}`);
    const data = await res.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") return [];
    return data.results || [];
  });

  return value || [];
}

async function fetchDetails(placeId) {
  const key = getGoogleMapsKey();
  if (!key || !placeId) return null;

  const params = new URLSearchParams({
    key,
    place_id: placeId,
    fields: "name,formatted_address,geometry,rating,user_ratings_total,price_level,types,opening_hours,photos,url,website,vicinity",
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
    priceSigns: priceSigns(priceLevel),
    cuisineType: cuisineFromTypes(types),
    photoUrl: photoUrl(photoRef),
    hours: details?.opening_hours?.weekday_text?.join("; ") || null,
    openNow: details?.opening_hours?.open_now ?? place.opening_hours?.open_now ?? null,
    currentlyOpen: details?.opening_hours?.open_now ?? place.opening_hours?.open_now ?? null,
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

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { lat, lng, city, answers = {}, limit = 6, roadStop = false } = req.body || {};
  if (lat == null || lng == null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  try {
    const raw = await nearbyRestaurants(lat, lng, roadStop ? "fast food casual dining" : "restaurant");
    const seen = new Set();
    const unique = raw.filter(p => {
      if (!p.place_id || seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    }).slice(0, 12);

    const detailed = await Promise.all(
      unique.slice(0, 10).map(async (place) => {
        const details = await fetchDetails(place.place_id);
        return mapRestaurant(place, details, lat, lng, city);
      }),
    );

    const filtered = filterByPreferences(detailed, answers, { roadStop });
    const pool = filtered.length ? filtered : detailed;
    const sorted = pool
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.userRatingsTotal ?? 0) - (a.userRatingsTotal ?? 0))
      .slice(0, limit);

    return res.status(200).json({ restaurants: sorted, city: city || null });
  } catch (err) {
    console.error("restaurants API error:", err);
    return res.status(500).json({ error: "Failed to fetch restaurants" });
  }
}
