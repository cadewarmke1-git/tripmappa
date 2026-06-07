/** Request guards for /api/plan-trip — auth, client header, payload validation. */

const CLIENT_HEADER = "x-tripmappa-client";
const EXPECTED_CLIENT = "web";
const MAX_LOCATION_LEN = 200;

export function rejectPlanTripRequest(res, status, reason, extra = {}) {
  console.warn("[plan-trip] rejected:", { status, reason, ...extra });
  res.status(status).json({ error: reason, ...extra });
  return true;
}

export function requireTripMappaClient(req, res) {
  const value = req.headers[CLIENT_HEADER] || req.headers[CLIENT_HEADER.toLowerCase()];
  if (String(value).toLowerCase() !== EXPECTED_CLIENT) {
    return rejectPlanTripRequest(res, 403, "Forbidden — invalid client", { code: "invalid_client" });
  }
  return null;
}

export function requireAuthenticatedUser(user, res) {
  if (!user) {
    return rejectPlanTripRequest(res, 401, "Authentication required", { code: "unauthenticated" });
  }
  return null;
}

export function validatePlanTripPayload(body, res) {
  const { origin, destination, answers } = body || {};
  if (typeof origin !== "string" || !origin.trim()) {
    return rejectPlanTripRequest(res, 400, "Origin is required", { code: "invalid_origin" });
  }
  if (origin.trim().length > MAX_LOCATION_LEN) {
    return rejectPlanTripRequest(res, 400, "Origin is too long", { code: "invalid_origin" });
  }
  if (typeof destination !== "string" || !destination.trim()) {
    return rejectPlanTripRequest(res, 400, "Destination is required", { code: "invalid_destination" });
  }
  if (destination.trim().length > MAX_LOCATION_LEN) {
    return rejectPlanTripRequest(res, 400, "Destination is too long", { code: "invalid_destination" });
  }
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return rejectPlanTripRequest(res, 400, "Trip answers are required", { code: "invalid_answers" });
  }
  if (!answers.vehicle) {
    return rejectPlanTripRequest(res, 400, "Vehicle is required in trip answers", { code: "missing_vehicle" });
  }
  return null;
}

export function buildCorridorPlacesFallback(routeInfo = {}, existingPrompt = "") {
  if (existingPrompt?.trim()) return existingPrompt.trim();
  const cities = Array.isArray(routeInfo.citiesAlongRoute)
    ? routeInfo.citiesAlongRoute.filter(Boolean)
    : [];
  if (!cities.length) return "";
  return [
    "=== CORRIDOR GEOGRAPHY (no verified placesContext — anchor recommendations to this corridor) ===",
    `Route passes through: ${cities.join(", ")} — use only real verified businesses in these cities.`,
  ].join("\n");
}
