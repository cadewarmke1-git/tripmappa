/** Placeholder lodging data for Phase 3 — replaced by Booking.com API later. */

export const AMENITY_DEFS = {
  wifi: { id: "wifi", label: "Free WiFi" },
  parking: { id: "parking", label: "Free Parking" },
  pet: { id: "pet", label: "Pet Friendly" },
  pool: { id: "pool", label: "Pool" },
  restaurant: { id: "restaurant", label: "Restaurant" },
  ev: { id: "ev", label: "EV Charging" },
  truckParking: { id: "truckParking", label: "Truck Parking" },
  rvHookups: { id: "rvHookups", label: "RV Hookups" },
};

const HOTEL_PHOTOS = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
];

const RV_PHOTOS = [
  "https://images.unsplash.com/photo-1523987355523-c7b5e0a90be7?w=800&q=80",
  "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80",
  "https://images.unsplash.com/photo-1478131143081-80d7ee74b367?w=800&q=80",
];

const TRUCK_PHOTOS = [
  "https://images.unsplash.com/photo-1601584111129-1316237406929?w=800&q=80",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80",
  "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&q=80",
];

/**
 * Placeholder hotel catalogs — kept for reference / future Booking.com swap.
 * Never surface these in the results UI; getHotelsForStop returns [].
 */
export const PLACEHOLDER_HOTELS = {
  "amarillo, tx": [
    {
      id: "marriott-amarillo-downtown",
      name: "Marriott Amarillo Downtown",
      stars: 4,
      neighborhood: "Downtown Amarillo",
      pricePerNight: 149,
      priceLabel: "$149/night",
      amenities: ["wifi", "parking", "pool", "restaurant"],
      description: "Modern downtown hotel with skyline views and an on-site bistro near Route 66 landmarks.",
      distanceFromRoute: 0.8,
      bookUrl: "https://example.com/book/marriott-amarillo-downtown",
      photo: HOTEL_PHOTOS[0],
      kidFriendly: true,
      rating: 4.5,
      propertyType: "hotel",
    },
    {
      id: "hampton-inn-amarillo",
      name: "Hampton Inn Amarillo",
      stars: 3,
      rating: 4.2,
      neighborhood: "West Amarillo",
      pricePerNight: 89,
      priceLabel: "$89/night",
      amenities: ["wifi", "parking", "ev"],
      description: "Reliable mid-range stay with complimentary hot breakfast and easy I-40 access.",
      distanceFromRoute: 1.2,
      bookUrl: "https://example.com/book/hampton-inn-amarillo",
      photo: HOTEL_PHOTOS[1],
      propertyType: "hotel",
    },
    {
      id: "budget-inn-amarillo",
      name: "Budget Inn Amarillo",
      stars: 2,
      neighborhood: "East Amarillo",
      pricePerNight: 52,
      priceLabel: "$52/night",
      amenities: ["wifi", "parking"],
      description: "Affordable overnight stop with clean rooms and truck-friendly parking nearby.",
      distanceFromRoute: 2.1,
      bookUrl: "https://example.com/book/budget-inn-amarillo",
      photo: HOTEL_PHOTOS[2],
      rating: 3.6,
      propertyType: "hotel",
    },
  ],
  "albuquerque, nm": [
    {
      id: "hyatt-regency-albuquerque",
      name: "Hyatt Regency Albuquerque",
      stars: 4,
      neighborhood: "Downtown Albuquerque",
      pricePerNight: 189,
      priceLabel: "$189/night",
      amenities: ["wifi", "pool", "restaurant", "ev"],
      description: "Upscale downtown property steps from Old Town with rooftop dining and EV chargers.",
      distanceFromRoute: 0.6,
      bookUrl: "https://example.com/book/hyatt-regency-albuquerque",
      photo: HOTEL_PHOTOS[0],
      kidFriendly: true,
      rating: 4.4,
    },
    {
      id: "holiday-inn-express-albuquerque",
      name: "Holiday Inn Express Albuquerque",
      stars: 3,
      neighborhood: "Midtown Albuquerque",
      pricePerNight: 109,
      priceLabel: "$109/night",
      amenities: ["wifi", "parking", "pool"],
      description: "Comfortable chain hotel with indoor pool and quick access to I-25 and I-40.",
      distanceFromRoute: 1.4,
      bookUrl: "https://example.com/book/holiday-inn-express-albuquerque",
      photo: HOTEL_PHOTOS[1],
      kidFriendly: true,
      rating: 4.1,
    },
    {
      id: "motel-6-albuquerque",
      name: "Motel 6 Albuquerque",
      stars: 2,
      neighborhood: "North Valley",
      pricePerNight: 59,
      priceLabel: "$59/night",
      amenities: ["wifi", "parking"],
      description: "Budget-friendly motel with pet-friendly rooms and straightforward highway access.",
      distanceFromRoute: 2.3,
      bookUrl: "https://example.com/book/motel-6-albuquerque",
      photo: HOTEL_PHOTOS[2],
      rating: 3.4,
    },
  ],
  "flagstaff, az": [
    {
      id: "little-america-flagstaff",
      name: "Little America Hotel Flagstaff",
      stars: 4,
      neighborhood: "East Flagstaff",
      pricePerNight: 199,
      priceLabel: "$199/night",
      amenities: ["wifi", "parking", "pool", "restaurant", "pet"],
      description: "Sprawling resort-style hotel with ponderosa pines, pool, and family-friendly dining.",
      distanceFromRoute: 1.0,
      bookUrl: "https://example.com/book/little-america-flagstaff",
      photo: HOTEL_PHOTOS[0],
      kidFriendly: true,
      rating: 4.6,
    },
    {
      id: "courtyard-flagstaff",
      name: "Courtyard Flagstaff",
      stars: 3,
      neighborhood: "Historic Downtown",
      pricePerNight: 129,
      priceLabel: "$129/night",
      amenities: ["wifi", "parking", "ev"],
      description: "Contemporary hotel near downtown Flagstaff with EV charging and mountain views.",
      distanceFromRoute: 0.9,
      bookUrl: "https://example.com/book/courtyard-flagstaff",
      photo: HOTEL_PHOTOS[1],
      rating: 4.3,
    },
    {
      id: "super-8-flagstaff",
      name: "Super 8 Flagstaff",
      stars: 2,
      neighborhood: "West Flagstaff",
      pricePerNight: 69,
      priceLabel: "$69/night",
      amenities: ["wifi", "parking"],
      description: "Simple, affordable rooms ideal for a one-night stop on the way to the Grand Canyon.",
      distanceFromRoute: 1.8,
      bookUrl: "https://example.com/book/super-8-flagstaff",
      photo: HOTEL_PHOTOS[2],
      rating: 3.5,
    },
  ],
};

const REST_AREA_PHOTO = "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80";

export const PLACEHOLDER_REST_AREAS = {
  default: [
    {
      id: "rest-area-eastbound",
      name: "I-40 Eastbound Rest Area",
      highwayLocation: "I-40 East, MM 142",
      parkingSpaces: 28,
      amenities: ["Restrooms", "Vending", "Picnic area", "Pet area"],
      distanceFromRoute: 12,
      stopType: "full overnight stop",
      note: "Well-lit overnight parking permitted — quiet hours after 10 PM",
      photo: REST_AREA_PHOTO,
    },
  ],
};

export const PLACEHOLDER_RV_PARKS = {
  default: [
    {
      id: "koa-journey",
      name: "KOA Journey",
      hookups: "Full hookups",
      dumpStation: true,
      maxLength: "45 feet",
      pricePerNight: 52,
      priceLabel: "$52/night",
      description: "Full-service RV park with pull-through sites, WiFi, laundry, and a camp store.",
      distanceFromRoute: 1.1,
      amenities: ["wifi", "pool", "rvHookups"],
      photo: RV_PHOTOS[0],
      reserveUrl: "https://example.com/reserve/koa-journey",
    },
    {
      id: "walmart-overnight",
      name: "Walmart Overnight Parking",
      hookups: "Dry camping only",
      dumpStation: false,
      maxLength: "Unlimited",
      pricePerNight: 0,
      priceLabel: "Free",
      description: "Overnight parking in a well-lit lot — confirm with store management before settling in.",
      distanceFromRoute: 0.4,
      amenities: ["parking"],
      photo: RV_PHOTOS[1],
      reserveUrl: "https://example.com/reserve/walmart-overnight",
    },
    {
      id: "state-park-campground",
      name: "State Park Campground",
      hookups: "Partial hookups",
      dumpStation: true,
      maxLength: "35 feet",
      pricePerNight: 28,
      priceLabel: "$28/night",
      description: "Scenic state park sites with water and electric hookups and easy access to hiking trails.",
      distanceFromRoute: 3.2,
      amenities: ["rvHookups", "pet"],
      photo: RV_PHOTOS[2],
      reserveUrl: "https://example.com/reserve/state-park-campground",
    },
  ],
};

export const PLACEHOLDER_TRUCK_STOPS = {
  default: [
    {
      id: "pilot-flying-j",
      name: "Pilot Flying J",
      parkingSpaces: 47,
      showerCost: "$12",
      laundry: true,
      dieselPrice: "$3.89/gal",
      foodOptions: "Subway and Wendy's on site",
      description: "Large travel center with ample rig parking, showers, laundry, and quick-service food.",
      distanceFromRoute: 0.2,
      amenities: ["truckParking", "restaurant", "wifi"],
      photo: TRUCK_PHOTOS[0],
      reserveUrl: "https://example.com/reserve/pilot-flying-j",
    },
    {
      id: "loves-travel-stop",
      name: "Love's Travel Stop",
      parkingSpaces: 31,
      showerCost: "$10",
      laundry: true,
      dieselPrice: "$3.85/gal",
      foodOptions: "McDonald's and Chester's Chicken on site",
      description: "Reliable Love's location with competitive diesel pricing and clean shower facilities.",
      distanceFromRoute: 0.5,
      amenities: ["truckParking", "restaurant", "wifi"],
      photo: TRUCK_PHOTOS[1],
      reserveUrl: "https://example.com/reserve/loves-travel-stop",
    },
    {
      id: "petro-stopping-center",
      name: "Petro Stopping Center",
      parkingSpaces: 62,
      showerCost: "$11",
      laundry: true,
      dieselPrice: "$3.91/gal",
      foodOptions: "Iron Skillet restaurant on site",
      description: "Full-service Petro with the most parking spaces, sit-down dining, and CAT scales.",
      distanceFromRoute: 0.8,
      amenities: ["truckParking", "restaurant", "wifi"],
      photo: TRUCK_PHOTOS[2],
      reserveUrl: "https://example.com/reserve/petro-stopping-center",
    },
  ],
};

function parsePrice(item) {
  if (item.pricePerNight != null) return item.pricePerNight;
  return parseInt(String(item.priceLabel || "0").replace(/\D/g, ""), 10) || 0;
}

function rvHookupRank(park) {
  if (park.id === "walmart-overnight") return 99;
  const h = (park.hookups || "").toLowerCase();
  if (h.includes("full")) return 0;
  if (h.includes("partial")) return 1;
  if (h.includes("dry")) return 2;
  return 1;
}

function matchesTruckStopBrand(stop, brand) {
  if (!brand || brand === "No preference") return false;
  const name = stop.name.toLowerCase();
  const b = brand.toLowerCase();
  if (b.includes("pilot") || b.includes("flying j")) return name.includes("pilot");
  if (b.includes("love")) return name.includes("love");
  if (b.includes("petro")) return name.includes("petro");
  if (b.includes("ta travel")) return name.includes("ta");
  return name.includes(b.split(" ")[0]);
}

function normalizeCityKey(city) {
  return (city || "").trim().toLowerCase();
}

export function getLodgingSortTier(lodging) {
  const l = (lodging || "").trim();
  if (l === "Budget" || l === "Motel" || l === "Camping" || l === "Camping or Outdoors") return "budget";
  if (l === "Luxury" || l === "Airbnb" || l === "Airbnb or Vacation Rental") return "luxury";
  if (l === "Mid-Range" || l === "Mid-range" || l === "Hotel") return "mid";
  if (l === "Doesn't Matter" || l === "Doesn't matter") return "any";
  return "mid";
}

function hotelRating(hotel) {
  return hotel.rating ?? hotel.stars ?? 0;
}

function propertyType(hotel) {
  return hotel.propertyType || "hotel";
}

function filterHotelsByPreference(hotels, lodgingPref) {
  const pref = (lodgingPref || "").trim();
  if (pref === "Budget") {
    const filtered = hotels.filter(h => parsePrice(h) < 80 && (h.stars || 0) <= 2);
    return filtered.length ? filtered : hotels.filter(h => parsePrice(h) < 80);
  }
  if (pref === "Luxury") {
    const filtered = hotels.filter(h => (h.stars || 0) >= 4 && hotelRating(h) >= 4.5);
    return filtered.length ? filtered : hotels.filter(h => (h.stars || 0) >= 4);
  }
  if (pref === "Airbnb or Vacation Rental") {
    const rentals = hotels.filter(h => propertyType(h) === "vacation_rental");
    return rentals.length ? rentals : hotels;
  }
  if (pref === "Camping or Outdoors") {
    const camping = hotels.filter(h => propertyType(h) === "campground" || propertyType(h) === "camping");
    return camping.length ? camping : hotels.filter(h => (h.stars || 0) <= 2);
  }
  return hotels;
}

function sortHotels(hotels, lodgingPref) {
  const pref = (lodgingPref || "").trim();
  const sorted = [...hotels];

  if (pref === "Budget") {
    sorted.sort((a, b) => parsePrice(a) - parsePrice(b));
  } else if (pref === "Luxury") {
    sorted.sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars;
      if (hotelRating(b) !== hotelRating(a)) return hotelRating(b) - hotelRating(a);
      return parsePrice(b) - parsePrice(a);
    });
  } else if (pref === "Mid-Range") {
    sorted.sort((a, b) => {
      const aMid = a.stars === 3 ? 0 : 1;
      const bMid = b.stars === 3 ? 0 : 1;
      if (aMid !== bMid) return aMid - bMid;
      return Math.abs(a.stars - 3) - Math.abs(b.stars - 3);
    });
  } else if (pref === "Airbnb or Vacation Rental") {
    sorted.sort((a, b) => {
      const aRent = propertyType(a) === "vacation_rental" ? 0 : 1;
      const bRent = propertyType(b) === "vacation_rental" ? 0 : 1;
      if (aRent !== bRent) return aRent - bRent;
      return hotelRating(b) - hotelRating(a);
    });
  } else if (pref === "Camping or Outdoors") {
    sorted.sort((a, b) => {
      const aCamp = ["campground", "camping"].includes(propertyType(a)) ? 0 : 1;
      const bCamp = ["campground", "camping"].includes(propertyType(b)) ? 0 : 1;
      if (aCamp !== bCamp) return aCamp - bCamp;
      return parsePrice(a) - parsePrice(b);
    });
  } else {
    sorted.sort((a, b) => {
      const diff = hotelRating(b) - hotelRating(a);
      if (diff !== 0) return diff;
      return b.stars - a.stars;
    });
  }
  return sorted;
}

function applyHotelBadges(hotels, lodgingPref) {
  const pref = (lodgingPref || "").trim();
  const isLuxury = pref === "Luxury";
  const isBudget = pref === "Budget";

  return hotels.map((h, index) => {
    const badges = [];
    if (isBudget && index === 0) badges.push("bestValue");
    if (isLuxury && index === 0) badges.push("premium");
    if (isLuxury && hotelRating(h) >= 4.5) badges.push("topRated");
    return { ...h, badges };
  });
}

/** Never used in product UI — returns [] so fake hotels cannot appear in results. */
function generateGenericHotels(_city) {
  return [];
}

/**
 * Hotels for a stop — never returns placeholder/generic hotels.
 * Live lodging comes from Places via LodgingCardsSection; callers should hide
 * the lodging section when this is empty rather than showing fake properties.
 */
export function getHotelsForStop(_city, _answers) {
  return [];
}

export function getRvParksForStop(_city) {
  const parks = PLACEHOLDER_RV_PARKS.default.map(p => ({ ...p }));
  return parks.sort((a, b) => rvHookupRank(a) - rvHookupRank(b));
}

export function getTruckStopsForStop(_city, answers) {
  let stops = [...PLACEHOLDER_TRUCK_STOPS.default].sort(
    (a, b) => b.parkingSpaces - a.parkingSpaces,
  );
  const brand = answers?.truck_stop_brand;
  if (brand && brand !== "No preference") {
    const idx = stops.findIndex(s => matchesTruckStopBrand(s, brand));
    if (idx > 0) {
      const [preferred] = stops.splice(idx, 1);
      stops.unshift(preferred);
    } else if (idx === 0) {
      // already first
    }
  }
  return stops.slice(0, 3);
}

export function getRestAreasForStop(_city) {
  return PLACEHOLDER_REST_AREAS.default.map(r => ({ ...r }));
}

export function saveLodgingToTrips(lodging, city, origin, dest) {
  try {
    const saved = JSON.parse(localStorage.getItem("tripmappa-saved-lodging") || "[]");
    saved.unshift({
      id: `${lodging.id}-${Date.now()}`,
      lodging,
      city,
      origin,
      dest,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem("tripmappa-saved-lodging", JSON.stringify(saved.slice(0, 50)));
    return true;
  } catch {
    return false;
  }
}
