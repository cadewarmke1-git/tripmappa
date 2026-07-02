/** Map Google Places lodging results to hotel card shape. */
import {
  filterLodgingByBudget,
  filterLodgingByTier,
  filterSafeStopsOnly,
  estimateNightlyFromPlace,
  lodgingTierToPriceBand,
  sortLodgingByLoyalty,
} from "./placesFilters.js";
import { getLoyaltyKeyword, needsSafeStopsOnly } from "./tripAccommodations.js";
import { resolveHotelListingUrl } from "./lodgingBookingLinks.js";

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

const PRICE_BAND_LABELS = {
  budget: "Budget (under $80/night)",
  mid: "Mid-range ($90–$160/night)",
  luxury: "Luxury ($200+/night)",
};

export function formatLodgingPriceLabel(place, answers) {
  if (place.pricePerNight != null && place.priceSource === "affiliate") {
    return `$${place.pricePerNight}/night`;
  }
  const band = place.price_band || place.priceBand || lodgingTierToPriceBand(answers?.lodging)
    || (() => {
      const level = place.priceLevel ?? 2;
      if (level <= 1) return "budget";
      if (level >= 4) return "luxury";
      return "mid";
    })();
  return PRICE_BAND_LABELS[band] || "Price varies";
}

export function mapPlaceToHotel(place, answers, routeInfo) {
  const nightly = place.pricePerNight != null && place.priceSource === "affiliate"
    ? place.pricePerNight
    : null;
  const priceLabel = formatLodgingPriceLabel(place, answers);
  return {
    id: place.id || place.placeId,
    placeId: place.placeId,
    name: place.name,
    stars: starsFromRating(place.rating),
    rating: place.rating,
    userRatingsTotal: place.userRatingsTotal,
    neighborhood: place.address?.split(",")[0] || "Near route",
    pricePerNight: nightly,
    priceLabel,
    priceIsEstimated: nightly == null,
    amenities: ["wifi", "parking"],
    description: place.rating ? `${place.rating} / 5 · ${place.userRatingsTotal ?? 0} reviews` : "Lodging near your route",
    verified: place.verified === true,
    distanceFromRoute: place.distanceMiles ?? 1,
    bookUrl: resolveHotelListingUrl(place),
    bookingUrl: place.bookingUrl || null,
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
