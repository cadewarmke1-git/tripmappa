/** Shared Google Places result filters for trip accommodations. */
import { getTripBudgetCap, needsSafeStopsOnly, getLoyaltyKeyword } from "./tripAccommodations.js";
import { estimateOvernightStops } from "./budget.js";
import { parseHoursFromDuration } from "./parsing.js";

const PRICE_LEVEL_NIGHTLY = [55, 75, 110, 165, 280];

const GENERIC_CHAIN_RE = /\b(mcdonald|burger king|wendy|taco bell|kfc|subway|chipotle|panda express|arby|sonic|jack in the box|dairy queen|popeyes|chick-fil-a|five guys|starbucks|dunkin|domino|pizza hut|little caesar|papa john|panera|jamba|qdoba|moe's|jersey mike|firehouse subs|jimmy john|potbelly|noodles|hardee|carl's jr|del taco|white castle|checkers|rally|steak 'n shake|bojangles|raising cane|culver|zaxby|in-n-out|whataburger)\b/i;

export function estimateNightlyFromPlace(place) {
  if (place.pricePerNight != null) return place.pricePerNight;
  const level = place.priceLevel ?? 2;
  return PRICE_LEVEL_NIGHTLY[Math.min(4, Math.max(0, level))] ?? 110;
}

export function filterSafeStopsOnly(places) {
  return places.filter(p => (p.rating ?? 0) >= 4 && (p.userRatingsTotal ?? 0) >= 20);
}

export function isGenericChainPlace(place) {
  return GENERIC_CHAIN_RE.test(`${place?.name || ""} ${place?.address || ""}`);
}

/** Prefer independent/local venues unless the list would be empty. */
export function filterGenericChains(places, { allowChains = false } = {}) {
  if (allowChains || !places?.length) return places || [];
  const independent = places.filter(p => !isGenericChainPlace(p));
  return independent.length ? independent : places;
}

/** Keep well-rated places when enough exist; otherwise return the original list. */
export function filterRatingBand(places, { minRating = 3.8, minReviews = 12 } = {}) {
  if (!places?.length) return places || [];
  const rated = places.filter(p => (p.rating ?? 0) >= minRating && (p.userRatingsTotal ?? 0) >= minReviews);
  return rated.length >= Math.min(2, places.length) ? rated : places;
}

export function filterOpen24Hour(places) {
  return places.filter(p => {
    if (p.openNow === true) return true;
    const hours = (p.hours || "").toLowerCase();
    return hours.includes("24 hour") || hours.includes("open 24") || hours.includes("24/7");
  });
}

export function filterOnRouteMiles(places, maxMiles = 1) {
  return places.filter(p => (p.distanceMiles ?? 99) <= maxMiles);
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
    const filtered = places.filter(p => nightly(p) <= 85 || (p.priceLevel ?? 2) <= 1);
    return filtered.length ? filtered : places;
  }
  if (tier === "Mid-Range") {
    const filtered = places.filter(p => {
      const n = nightly(p);
      return n >= 65 && n <= 165;
    });
    return filtered.length ? filtered : places;
  }
  if (tier === "Luxury") {
    const filtered = places.filter(p => nightly(p) >= 120 || (p.rating ?? 0) >= 4.3);
    return filtered.length ? filtered : places;
  }
  return places;
}

export function sortLodgingByLoyalty(places, answers) {
  const loyalty = getLoyaltyKeyword(answers);
  if (!loyalty) return places;
  const key = loyalty.toLowerCase();
  return [...places].sort((a, b) => {
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
