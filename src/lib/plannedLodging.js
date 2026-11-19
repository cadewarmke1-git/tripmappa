/** Map planner overnight hotel suggestions into HotelCard shape when Places is unavailable. */

const DEFAULT_PHOTO = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80";

export function mapPlannedHotelsToCards(hotels = [], city = "") {
  if (!Array.isArray(hotels) || !hotels.length) return [];
  const cityLabel = String(city || "").split(",")[0].trim() || "Overnight stop";
  const out = [];
  const seen = new Set();

  hotels.forEach((hotel, idx) => {
    const name = String(hotel?.name || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const stars = Number(hotel.stars);
    out.push({
      id: hotel.id || hotel.placeId || `planned-hotel-${idx}-${key}`,
      placeId: hotel.placeId || null,
      name,
      stars: Number.isFinite(stars) && stars > 0 ? Math.min(5, Math.round(stars)) : 3,
      rating: hotel.rating ?? null,
      neighborhood: cityLabel,
      priceLabel: hotel.price || hotel.priceLabel || "Price varies",
      priceIsEstimated: true,
      amenities: hotel.pet ? ["pets"] : ["wifi", "parking"],
      description: hotel.rating != null ? `${hotel.rating} / 5` : "Suggested stay for this overnight",
      verified: hotel.verified === true,
      distanceFromRoute: null,
      bookUrl: null,
      bookingUrl: null,
      photo: hotel.photoUrl || hotel.photo || DEFAULT_PHOTO,
      badges: [],
      fromGooglePlaces: false,
      fromPlanner: true,
    });
  });

  return out;
}
