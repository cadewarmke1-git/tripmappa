/** Lodging helpers — amenities + save. Fake PLACEHOLDER parks/stops removed for beta safety. */

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

/**
 * Legacy sync getters — always empty.
 * Live RV parks / truck stops / rest areas come from Google Places via
 * commercialLodgingPlaces.js (same pattern as hotels). Returning [] avoids
 * showing non-local example.com placeholder lodging when Places has nothing.
 */
export function getRvParksForStop(_city) {
  return [];
}

export function getTruckStopsForStop(_city, _answers) {
  return [];
}

export function getRestAreasForStop(_city) {
  return [];
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
