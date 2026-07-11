/** Shared Google Places result filters for trip accommodations. */
import { getTripBudgetCap, needsSafeStopsOnly, getLoyaltyKeyword, asArray, prefIncludes } from "./tripAccommodations.js";
import { estimateOvernightStops } from "./budget.js";
import { parseHoursFromDuration } from "./parsing.js";
import { isNationalChainPlace } from "./nationalRestaurantChains.js";

const PRICE_LEVEL_NIGHTLY = [55, 75, 110, 165, 280];

/** Google Places types that indicate food service. */
export const FOOD_SERVING_TYPES = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "meal_takeaway",
  "meal_delivery",
  "food",
  "fast_food_restaurant",
]);

/** Primary/non-food types that must never appear in food or road-stop restaurant lists. */
export const NON_FOOD_PRIMARY_TYPES = new Set([
  "car_dealer",
  "car_repair",
  "car_wash",
  "lodging",
  "hotel",
  "motel",
  "airport",
  "real_estate_agency",
  "gas_station",
  "electric_vehicle_charging_station",
  "store",
  "shopping_mall",
  "hospital",
  "doctor",
  "pharmacy",
  "school",
  "church",
  "park",
  "museum",
  "gym",
  "spa",
  "bank",
  "atm",
  "parking",
  "local_government_office",
]);

export const LODGING_TYPES = new Set([
  "lodging",
  "hotel",
  "motel",
  "campground",
  "rv_park",
  "bed_and_breakfast",
]);

export function placeTypes(place) {
  const raw = place?.types || place?.placeTypes || [];
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function isFoodServingPlace(place) {
  const types = placeTypes(place);
  if (!types.length) return false;
  const hasFood = types.some(t => FOOD_SERVING_TYPES.has(t));
  if (!hasFood) return false;
  const primary = types[0];
  if (primary && NON_FOOD_PRIMARY_TYPES.has(primary)) return false;
  if (primary && LODGING_TYPES.has(primary)) return false;
  return true;
}

export function isLodgingPlace(place) {
  const types = placeTypes(place);
  if (!types.length) return true;
  if (types.some(t => NON_FOOD_PRIMARY_TYPES.has(t) && !LODGING_TYPES.has(t) && t !== "point_of_interest")) {
    const primary = types[0];
    if (primary && NON_FOOD_PRIMARY_TYPES.has(primary) && !LODGING_TYPES.has(primary)) return false;
  }
  return types.some(t => LODGING_TYPES.has(t));
}

export function filterFoodCandidates(places = []) {
  return (places || []).filter(p => isFoodServingPlace(p));
}

export function filterLodgingCandidates(places = []) {
  return (places || []).filter(p => isLodgingPlace(p));
}

export function allowsNationalChains(answers) {
  const dietary = asArray(answers?.dietary);
  if (dietary.includes("Drive-Through Only")) return true;
  return prefIncludes(answers, "Fast food only");
}

export function estimateNightlyFromPlace(place) {
  if (place.pricePerNight != null) return place.pricePerNight;
  const level = place.priceLevel ?? 2;
  return PRICE_LEVEL_NIGHTLY[Math.min(4, Math.max(0, level))] ?? 110;
}

export function filterSafeStopsOnly(places) {
  return places.filter(p => (p.rating ?? 0) >= 4 && (p.userRatingsTotal ?? 0) >= 20);
}

/** Prefer independent/local venues unless the list would be empty. */
export function filterGenericChains(places, { allowChains = false } = {}) {
  if (allowChains || !places?.length) return places || [];
  const independent = places.filter(p => !isNationalChainPlace(p));
  return independent.length ? independent : places;
}

/** Prefer beloved local spots: rating ≥4.2, reviews 50–5000. */
export function filterRatingBand(places, { minRating = 4.2, minReviews = 50, maxReviews = 5000 } = {}) {
  if (!places?.length) return places || [];
  const rated = places.filter((p) => {
    const reviews = p.userRatingsTotal ?? 0;
    return (p.rating ?? 0) >= minRating && reviews >= minReviews && reviews <= maxReviews;
  });
  return rated.length ? rated : places;
}

export function lodgingTierToPriceBand(lodging) {
  if (lodging === "Budget") return "budget";
  if (lodging === "Luxury") return "luxury";
  if (lodging === "Mid-Range") return "mid";
  return null;
}

export function filterOpen24Hour(places) {
  return places.filter(p => {
    if (p.openNow === true) return true;
    const hours = (p.hours || "").toLowerCase();
    return hours.includes("24 hour") || hours.includes("open 24") || hours.includes("24/7");
  });
}

export function filterLodgingByBudget(places, answers, routeInfo) {
  const cap = getTripBudgetCap(answers);
  if (cap == null) return places;
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const nights = estimateOvernightStops(hours, answers?.trip_type, answers?.lodging) || 1;
  const lodgingBudget = cap * 0.45;
  const maxPerNight = lodgingBudget / nights;
  const affordable = places.filter(p => estimateNightlyFromPlace(p) <= maxPerNight);
  return affordable.length ? affordable : places.slice(0, 3);
}

export function filterLodgingByTier(places, answers) {
  const tier = answers?.lodging;
  if (!tier || tier === "Doesn't Matter" || /sleeper|camp|airbnb|vacation rental/i.test(tier)) {
    return places;
  }
  const nightly = p => estimateNightlyFromPlace(p);
  if (tier === "Budget") {
    const filtered = places.filter(p => nightly(p) < 80 || (p.priceLevel ?? 2) <= 1);
    return filtered.length ? filtered : places;
  }
  if (tier === "Mid-Range") {
    const filtered = places.filter(p => {
      const n = nightly(p);
      return n >= 90 && n <= 160;
    });
    return filtered.length ? filtered : places;
  }
  if (tier === "Luxury") {
    const filtered = places.filter(p => nightly(p) >= 200 || (p.rating ?? 0) >= 4.4);
    return filtered.length ? filtered : places;
  }
  return places;
}

export function sortLodgingByLoyalty(places, answers) {
  const loyalty = getLoyaltyKeyword(answers);
  if (!loyalty) return places;
  const key = loyalty.toLowerCase();
  return places.toSorted((a, b) => {
    const aMatch = (a.name || "").toLowerCase().includes(key) ? 1 : 0;
    const bMatch = (b.name || "").toLowerCase().includes(key) ? 1 : 0;
    return bMatch - aMatch || (b.rating ?? 0) - (a.rating ?? 0);
  });
}

export function applyStopFilters(places, answers, { nightOnly = false } = {}) {
  let out = [...places];
  if (needsSafeStopsOnly(answers)) {
    const safe = filterSafeStopsOnly(out);
    if (safe.length) out = safe;
  }
  if (nightOnly) {
    const open = filterOpen24Hour(out);
    if (open.length) out = open;
  }
  return out;
}

export function parseFuelPriceString(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).match(/(\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : null;
}

export function markBestPriceFuelStations(stations, type = "gas") {
  if (!stations?.length) return stations;
  const priceKey = type === "diesel" ? "dieselPrice" : "regularPrice";
  const withPrices = stations.map(s => ({
    ...s,
    _price: parseFuelPriceString(s[priceKey]),
  }));
  const valid = withPrices.filter(s => s._price != null);
  if (!valid.length) return stations;
  const min = Math.min(...valid.map(s => s._price));
  return withPrices.map(s => ({
    ...s,
    bestPrice: s._price != null && s._price <= min + 0.01,
  }));
}
