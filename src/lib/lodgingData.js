/** Placeholder lodging data for Phase 3 — replaced by Booking.com API later. */

export const AMENITY_DEFS = {
  wifi: { id: "wifi", label: "Free WiFi", icon: "📶" },
  parking: { id: "parking", label: "Free Parking", icon: "🅿️" },
  pet: { id: "pet", label: "Pet Friendly", icon: "🐾" },
  pool: { id: "pool", label: "Pool", icon: "🏊" },
  restaurant: { id: "restaurant", label: "Restaurant", icon: "🍽️" },
  ev: { id: "ev", label: "EV Charging", icon: "⚡" },
  truckParking: { id: "truckParking", label: "Truck Parking", icon: "🚛" },
  rvHookups: { id: "rvHookups", label: "RV Hookups", icon: "🔌" },
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
    },
    {
      id: "hampton-inn-amarillo",
      name: "Hampton Inn Amarillo",
      stars: 3,
      neighborhood: "West Amarillo",
      pricePerNight: 89,
      priceLabel: "$89/night",
      amenities: ["wifi", "parking", "ev"],
      description: "Reliable mid-range stay with complimentary hot breakfast and easy I-40 access.",
      distanceFromRoute: 1.2,
      bookUrl: "https://example.com/book/hampton-inn-amarillo",
      photo: HOTEL_PHOTOS[1],
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

function normalizeCityKey(city) {
  return (city || "").trim().toLowerCase();
}

export function getLodgingSortTier(lodging) {
  if (lodging === "Motel" || lodging === "Camping") return "budget";
  if (lodging === "Hotel" || lodging === "Airbnb") return "luxury";
  return "mid";
}

function parsePrice(item) {
  if (item.pricePerNight != null) return item.pricePerNight;
  return parseInt(String(item.priceLabel || "0").replace(/\D/g, ""), 10) || 0;
}

function sortHotels(hotels, tier) {
  const sorted = [...hotels];
  if (tier === "budget") {
    sorted.sort((a, b) => parsePrice(a) - parsePrice(b));
  } else if (tier === "luxury") {
    sorted.sort((a, b) => {
      if (b.stars !== a.stars) return b.stars - a.stars;
      return parsePrice(b) - parsePrice(a);
    });
  } else {
    sorted.sort((a, b) => {
      const aMid = a.stars === 3 ? 0 : 1;
      const bMid = b.stars === 3 ? 0 : 1;
      if (aMid !== bMid) return aMid - bMid;
      return Math.abs(a.stars - 3) - Math.abs(b.stars - 3);
    });
  }
  return sorted;
}

function applyHotelBadges(hotels, answers, tier) {
  const cheapestId = [...hotels].sort((a, b) => parsePrice(a) - parsePrice(b))[0]?.id;
  const family = answers?.travelers === "Family with kids";
  const lodging = answers?.lodging;

  return hotels.map(h => ({
    ...h,
    badges: [
      ...((tier === "luxury" || lodging === "Hotel") && h.stars >= 4 ? ["premium"] : []),
      ...(tier === "budget" && h.id === cheapestId ? ["bestValue"] : []),
      ...(family && (h.kidFriendly || h.amenities?.includes("pool")) ? ["kidFriendly"] : []),
    ],
  }));
}

function generateGenericHotels(city) {
  const label = city.split(",")[0]?.trim() || "Route City";
  return [
    {
      id: `generic-hotel-${label}`,
      name: `${label} Grand Hotel`,
      stars: 4,
      neighborhood: `Downtown ${label}`,
      pricePerNight: 139,
      priceLabel: "$139/night",
      amenities: ["wifi", "parking", "pool", "restaurant"],
      description: `Well-rated hotel in ${city} with comfortable rooms and easy highway access.`,
      distanceFromRoute: 1.0,
      bookUrl: "https://example.com/book/generic-hotel",
      photo: HOTEL_PHOTOS[0],
      kidFriendly: true,
    },
    {
      id: `generic-inn-${label}`,
      name: `${label} Inn & Suites`,
      stars: 3,
      neighborhood: `${label} Midtown`,
      pricePerNight: 99,
      priceLabel: "$99/night",
      amenities: ["wifi", "parking", "ev"],
      description: `Reliable 3-star stay near ${city} with complimentary breakfast and EV charging.`,
      distanceFromRoute: 1.5,
      bookUrl: "https://example.com/book/generic-inn",
      photo: HOTEL_PHOTOS[1],
    },
    {
      id: `generic-motel-${label}`,
      name: `${label} Motel`,
      stars: 2,
      neighborhood: `${label} Highway District`,
      pricePerNight: 59,
      priceLabel: "$59/night",
      amenities: ["wifi", "parking"],
      description: `Budget-friendly motel along the route through ${city}.`,
      distanceFromRoute: 2.0,
      bookUrl: "https://example.com/book/generic-motel",
      photo: HOTEL_PHOTOS[2],
    },
  ];
}

export function getHotelsForStop(city, answers) {
  const key = normalizeCityKey(city);
  const base = PLACEHOLDER_HOTELS[key] || generateGenericHotels(city);
  const tier = getLodgingSortTier(answers?.lodging);
  const sorted = sortHotels(base, tier).slice(0, 3);
  return applyHotelBadges(sorted, answers, tier);
}

export function getRvParksForStop(_city) {
  return PLACEHOLDER_RV_PARKS.default.map(p => ({ ...p }));
}

export function getTruckStopsForStop(_city, answers) {
  const stops = PLACEHOLDER_TRUCK_STOPS.default.map(s => ({ ...s }));
  const brand = answers?.truck_stop_brand;
  if (brand && brand !== "No preference") {
    const preferred = stops.find(s => s.name.includes(brand.split(" ")[0]));
    if (preferred) {
      return [preferred, ...stops.filter(s => s.id !== preferred.id)].slice(0, 3);
    }
  }
  return stops;
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
