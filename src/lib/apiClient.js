import { readPlanTripSseStream } from "./planTripStream.js";
import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

async function readApiJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(response.ok ? "Invalid API response" : "Trip planning failed. Please try again in a moment.");
  }
}

function throwPlanTripError(response, data) {
  const err = new Error(data.error || "Failed to generate trip");
  err.code = data.code || (response.ok ? undefined : "api_error");
  err.httpStatus = response.status;
  err.credits = data.credits;
  err.limitReached = data.limitReached;
  err.resetDate = data.resetDate;
  err.tier = data.tier;
  err.rateLimited = data.rateLimited;
  err.limitType = data.limitType;
  err.retryAfter = data.retryAfter;
  throw err;
}

/** Frontend API layer — always call serverless routes, never Anthropic directly. */
export async function generateTripPlan(payload, accessToken = null, { signal, onStreamProgress } = {}) {
  const headers = tripMappaApiHeaders({ "Content-Type": "application/json" });
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch("/api/plan-trip", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    if (!response.ok) {
      const data = await readApiJson(response);
      throwPlanTripError(response, data);
    }
    return readPlanTripSseStream(response, signal, onStreamProgress);
  }

  const data = await readApiJson(response);
  if (!response.ok) throwPlanTripError(response, data);
  return data;
}

export async function enrichFuelStations(stations, mode = "gas") {
  const response = await fetch("/api/fuel-stations", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ stations, mode }),
  });
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data.error || "Fuel price enrichment failed");
  return data;
}

export async function discoverEvCharging(lat, lng, options = {}) {
  const { teslaOnly = false, fuelType = "ELEC", radius = 5 } = options;
  const response = await fetch("/api/ev-charging", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ discover: true, lat, lng, radius, fuelType, teslaOnly }),
  });
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data.error || "EV charging discovery failed");
  return data;
}

export async function enrichEvCharging(stations, fuelType = "ELEC", options = {}) {
  const { teslaOnly = false } = options;
  const response = await fetch("/api/ev-charging", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ stations, fuelType, teslaOnly }),
  });
  const data = await readApiJson(response);
  if (!response.ok) throw new Error(data.error || "EV charging enrichment failed");
  return data;
}
