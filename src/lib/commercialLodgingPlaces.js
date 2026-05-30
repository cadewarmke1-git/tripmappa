/** Google Places truck stops and RV parks near an overnight city. */
import { searchNearbyCategory } from "./placesSearch.js";
import { searchDieselStations } from "./placesStations.js";
import { filterStationsByPreferredBrand, getPreferredFuelBrand } from "./fuel.js";
import { applyStopFilters } from "./placesFilters.js";
import { prefIncludes } from "./tripAccommodations.js";

const TRUCK_PHOTO = "https://images.unsplash.com/photo-1601584111129-1316237406929?w=800&q=80";
const RV_PHOTO = "https://images.unsplash.com/photo-1523987355523-c7b5e0a90be7?w=800&q=80";

function mapsUrl(name, lat, lng) {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

export function mapPlaceToTruckStop(place) {
  return {
    id: place.id || place.placeId,
    placeId: place.placeId,
    name: place.name,
    parkingSpaces: "Available",
    showerCost: "On site",
    laundry: true,
    dieselPrice: "See pump",
    foodOptions: place.rating ? `${place.rating}★ on Google Maps` : "Travel center dining",
    description: place.address || "Truck stop along your route",
    distanceFromRoute: place.distanceMiles ?? 1,
    amenities: ["truckParking", "restaurant", "wifi"],
    photo: place.photoUrl || TRUCK_PHOTO,
    reserveUrl: place.bookUrl || place.website || mapsUrl(place.name, place.lat, place.lng),
    rating: place.rating,
    fromGooglePlaces: true,
  };
}

export function mapPlaceToRvPark(place, answers = {}) {
  const prefs = answers?.preferences || [];
  const blob = `${place.name || ""} ${place.address || ""}`;
  const hookups = /full hookup|50 amp|30 amp|water.*electric/i.test(blob)
    ? "Full hookups"
    : prefs.includes("Full hookups only") ? "Partial hookups" : "Water & electric";
  return {
    id: place.id || place.placeId,
    placeId: place.placeId,
    name: place.name,
    hookups,
    dumpStation: /dump|sanitary|sewage/i.test(blob) || prefs.includes("Need dump stations"),
    maxLength: "Confirm with park",
    pricePerNight: 45,
    priceLabel: "$45/night est.",
    description: place.rating
      ? `${place.rating}★ · ${place.userRatingsTotal ?? 0} reviews on Google Maps`
      : "RV park near your route",
    distanceFromRoute: place.distanceMiles ?? 2,
    amenities: ["rvHookups", "wifi"],
    photo: place.photoUrl || RV_PHOTO,
    reserveUrl: place.bookUrl || place.website || mapsUrl(place.name, place.lat, place.lng),
    fromGooglePlaces: true,
  };
}

function dedupeByPlaceId(places) {
  const seen = new Set();
  return places.filter(p => {
    const key = p.placeId || p.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchTruckStopsForCity(lat, lng, answers) {
  let stations = await searchDieselStations(lat, lng, 12, 8047);
  stations = filterStationsByPreferredBrand(stations, answers);
  stations = applyStopFilters(
    stations.map(s => ({ ...s, userRatingsTotal: s.userRatingsTotal ?? s.rating ? 40 : 0 })),
    answers,
  );

  if (!stations.length) {
    const brand = getPreferredFuelBrand(answers);
    const keyword = brand && brand !== "No preference" ? `${brand} travel center` : "truck stop travel center";
    const nearby = await searchNearbyCategory(lat, lng, {
      keyword,
      type: "gas_station",
      radius: 16093,
      maxResults: 10,
    });
    stations = applyStopFilters(nearby, answers);
  }

  return dedupeByPlaceId(stations)
    .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99))
    .slice(0, 5)
    .map(mapPlaceToTruckStop);
}

export async function fetchRvParksForCity(lat, lng, answers) {
  let keyword = "RV park campground";
  if (prefIncludes(answers, "Full hookups only")) keyword = "RV park full hookups";
  else if (prefIncludes(answers, "Dry camping ok")) keyword = "campground dry camping";

  let places = await searchNearbyCategory(lat, lng, {
    type: "campground",
    keyword,
    radius: 16093,
    maxResults: 12,
  });
  if (places.length < 3) {
    const extra = await searchNearbyCategory(lat, lng, { keyword: "RV park", radius: 16093, maxResults: 8 });
    places = [...places, ...extra];
  }

  places = applyStopFilters(places, answers);
  return dedupeByPlaceId(places)
    .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99))
    .slice(0, 5)
    .map(p => mapPlaceToRvPark(p, answers));
}

export async function fetchRestAreasForCity(lat, lng, answers) {
  const places = await searchNearbyCategory(lat, lng, {
    keyword: "rest area",
    radius: 32186,
    maxResults: 4,
  });
  const filtered = applyStopFilters(places, answers);
  return filtered.slice(0, 3).map(p => ({
    id: p.id || p.placeId,
    name: p.name,
    highwayLocation: p.address?.split(",")[0] || "Along highway",
    parkingSpaces: "Available",
    amenities: ["Restrooms", "Parking"],
    distanceFromRoute: p.distanceMiles ?? 5,
    stopType: "rest break",
    note: p.rating ? `${p.rating}★ on Google Maps` : "Public rest area",
    photo: p.photoUrl || "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80",
    fromGooglePlaces: true,
  }));
}
