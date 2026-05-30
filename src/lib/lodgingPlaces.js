/** Map Google Places lodging results to hotel card shape. */
import {
  filterLodgingByBudget,
  filterLodgingByTier,
  filterSafeStopsOnly,
  estimateNightlyFromPlace,
  sortLodgingByLoyalty,
} from "./placesFilters.js";
import { getLoyaltyKeyword, needsSafeStopsOnly } from "./tripAccommodations.js";

const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";

function starsFromRating(rating) {
  if (!rating) return 3;
  return Math.min(5, Math.max(1, Math.round(rating)));
}

function badgesFor(place, answers) {
  const badges = [];
  const loyalty = getLoyaltyKeyword(answers);
  if (loyalty && (place.name || "").toLowerCase().includes(loyalty.toLowerCase())) {
    badges.push("premium");
  }
  if ((place.rating ?? 0) >= 4.5) badges.push("topRated");
  if (estimateNightlyFromPlace(place) < 85) badges.push("bestValue");
  return badges;
}

export function mapPlaceToHotel(place, answers, routeInfo) {
  const nightly = estimateNightlyFromPlace(place);
  return {
    id: place.id || place.placeId,
    placeId: place.placeId,
    name: place.name,
    stars: starsFromRating(place.rating),
    rating: place.rating,
    neighborhood: place.address?.split(",")[0] || "Near route",
    pricePerNight: nightly,
    priceLabel: `$${nightly}/night`,
    amenities: ["wifi", "parking"],
    description: place.rating ? `${place.rating} / 5 · ${place.userRatingsTotal ?? 0} reviews` : "Verified on Google Maps",
    distanceFromRoute: place.distanceMiles ?? 1,
    bookUrl: place.bookUrl || place.website || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`,
    photo: place.photoUrl || DEFAULT_PHOTO,
    badges: badgesFor(place, answers),
    fromGooglePlaces: true,
  };
}

export function processLodgingResults(places, answers, routeInfo) {
  let out = [...places];
  if (needsSafeStopsOnly(answers)) {
    const safe = filterSafeStopsOnly(out);
    if (safe.length) out = safe;
  }
  out = filterLodgingByTier(out, answers);
  out = filterLodgingByBudget(out, answers, routeInfo);
  out = sortLodgingByLoyalty(out, answers);
  return out
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5)
    .map(p => mapPlaceToHotel(p, answers, routeInfo));
}
