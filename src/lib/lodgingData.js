/** Placeholder lodging data for Phase 3 — replaced by Booking.com API later. */

import {
  SAVED_LODGING_KEY,
  readLocalStorage,
  writeLocalStorage,
} from "./storageKeys.js";

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

export function getRvParksForStop(_city) {
  const parks = PLACEHOLDER_RV_PARKS.default.map(p => ({ ...p }));
  return parks.sort((a, b) => rvHookupRank(a) - rvHookupRank(b));
}

export function getTruckStopsForStop(_city, answers) {
  let stops = PLACEHOLDER_TRUCK_STOPS.default.toSorted(
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
    const saved = JSON.parse(readLocalStorage(SAVED_LODGING_KEY) || "[]");
    saved.unshift({
      id: `${lodging.id}-${Date.now()}`,
      lodging,
      city,
      origin,
      dest,
      savedAt: new Date().toISOString(),
    });
    writeLocalStorage(SAVED_LODGING_KEY, JSON.stringify(saved.slice(0, 50)));
    return true;
  } catch {
    return false;
  }
}
