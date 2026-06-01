import { searchGasStations, searchDieselStations, searchEvChargingStations, searchPropaneStations } from "./placesStations.js";

async function readApiJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(response.ok ? "Invalid API response" : "Trip planning failed. Please try again in a moment.");
  }
}

/** Frontend API layer — always call serverless routes, never Anthropic directly. */
export async function generateTripPlan(payload, accessToken = null, { signal } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch("/api/plan-trip", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });
  const data = await readApiJson(response);
  if (!response.ok) {
    const err = new Error(data.error || "Failed to generate trip");
    err.code = data.code;
    err.credits = data.credits;
    throw err;
  }
  return data;
}

export async function enrichFuelStations(stations, mode = "gas") {
  const response = await fetch("/api/fuel-stations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stations, mode }),
  });
  const data = await readApiJson(response);
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
  const data = await readApiJson(response);
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
