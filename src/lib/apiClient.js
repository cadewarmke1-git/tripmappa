import { searchGasStations, searchDieselStations, searchEvChargingStations, searchPropaneStations } from "./placesStations.js";

/** Frontend API layer — always call serverless routes, never Anthropic directly. */
export async function generateTripPlan(payload) {
  const response = await fetch("/api/plan-trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to generate trip");
  }
  return data;
}

export async function enrichFuelStations(stations, mode = "gas") {
  const response = await fetch("/api/fuel-stations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stations, mode }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Fuel price enrichment failed");
  return data;
}

export async function enrichEvCharging(stations, fuelType = "ELEC", options = {}) {
  const { teslaOnly = false } = options;
  const response = await fetch("/api/ev-charging", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stations, fuelType, teslaOnly }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "EV charging enrichment failed");
  return data;
}

export async function fetchFuelStations(latitude, longitude, mode = "gas") {
  const googleStations = mode === "diesel"
    ? await searchDieselStations(latitude, longitude)
    : await searchGasStations(latitude, longitude);
  if (!googleStations.length) return { stations: [], fallback: true };
  return enrichFuelStations(googleStations, mode);
}

/** @deprecated Use enrichEvCharging after Google Places search. */
export async function fetchEvCharging(latitude, longitude, fuelType = "ELEC", options = {}) {
  const googleStations = fuelType === "LPG"
    ? await searchPropaneStations(latitude, longitude)
    : await searchEvChargingStations(latitude, longitude);
  if (!googleStations.length) return { stations: [], fallback: true };
  return enrichEvCharging(googleStations, fuelType, options);
}
