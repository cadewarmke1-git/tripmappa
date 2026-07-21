/** Booking.com affiliate URL helpers — TripMappa-owned booking links, not raw Google Maps. */

const BOOKING_SEARCH_BASE = "https://www.booking.com/searchresults.html";

function bookingAffiliateId() {
  return import.meta.env.VITE_BOOKING_AFFILIATE_ID?.trim() || "";
}

function isGoogleMapsUrl(url) {
  return /google\.com\/maps/i.test(String(url || ""));
}

/**
 * Build a Booking.com search URL for a property (affiliate aid when configured).
 * @param {{ name?: string, neighborhood?: string, lat?: number, lng?: number }} hotel
 */
export function buildBookingAffiliateUrl(hotel) {
  const name = hotel?.name?.trim();
  if (!name) return null;

  const parts = [name];
  if (hotel.neighborhood?.trim()) parts.push(hotel.neighborhood.trim());

  const params = new URLSearchParams({
    ss: parts.join(", "),
    lang: "en-us",
  });

  const aid = bookingAffiliateId();
  if (aid) params.set("aid", aid);

  if (hotel.lat != null && hotel.lng != null) {
    params.set("latitude", String(hotel.lat));
    params.set("longitude", String(hotel.lng));
  }

  return `${BOOKING_SEARCH_BASE}?${params.toString()}`;
}

/**
 * Resolve the listing URL for hotel cards — affiliate first, then property site, never Google Maps.
 */
export function resolveHotelListingUrl(place = {}) {
  const booking = place.bookingUrl?.trim();
  if (booking && !isGoogleMapsUrl(booking)) return booking;
  const book = place.bookUrl?.trim();
  if (book && !isGoogleMapsUrl(book)) return book;
  const affiliate = buildBookingAffiliateUrl(place);
  if (affiliate) return affiliate;
  const website = place.website?.trim();
  if (website && !isGoogleMapsUrl(website)) return website;
  return null;
}
