/** Request guards for /api/plan-trip — auth, client header, payload validation. */

const CLIENT_HEADER = "x-tripmappa-client";
const EXPECTED_CLIENT = "web";
const MAX_LOCATION_LEN = 200;
const MAX_ANSWER_STRING_LEN = 500;
const MAX_ANSWER_ARRAY_LEN = 40;
const MAX_ANSWERS_JSON_BYTES = 48_000;
const MAX_ROUTE_INFO_JSON_BYTES = 250_000;
const MAX_LEGS = 24;
const MAX_PROMPT_CONTEXT_LEN = 8000;
const MAX_NESTED_OBJECT_KEYS = 80;

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

function jsonByteLength(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function sanitizeAnswersTree(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null) return value;
  if (typeof value === "string") return value.slice(0, MAX_ANSWER_STRING_LEN);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ANSWER_ARRAY_LEN).map((item) => sanitizeAnswersTree(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value).slice(0, MAX_NESTED_OBJECT_KEYS);
    for (const key of keys) {
      out[String(key).slice(0, 80)] = sanitizeAnswersTree(value[key], depth + 1);
    }
    return out;
  }
  return null;
}

export function validatePlanTripPayload(body, res) {
  const { origin, destination, answers, routeInfo, legs } = body || {};
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
  if (jsonByteLength(answers) > MAX_ANSWERS_JSON_BYTES) {
    return rejectPlanTripRequest(res, 400, "Trip answers payload is too large", { code: "answers_too_large" });
  }
  if (routeInfo != null && typeof routeInfo === "object" && jsonByteLength(routeInfo) > MAX_ROUTE_INFO_JSON_BYTES) {
    return rejectPlanTripRequest(res, 400, "Route info payload is too large", { code: "route_info_too_large" });
  }
  if (legs != null) {
    if (!Array.isArray(legs) || legs.length > MAX_LEGS) {
      return rejectPlanTripRequest(res, 400, "Too many route legs", { code: "invalid_legs" });
    }
  }

  const contextFields = [
    "placesContext",
    "generationHints",
    "preferenceContext",
    "recentTripsContext",
    "recentTripsPreferencesRollup",
    "userTravelPatterns",
    "travelerDossier",
    "stopRejectionsContext",
    "answerConfidenceNotes",
    "gracefulDegradationNotes",
  ];
  for (const field of contextFields) {
    const value = body?.[field];
    if (value == null) continue;
    if (typeof value !== "string") {
      return rejectPlanTripRequest(res, 400, `${field} must be a string`, { code: "invalid_context" });
    }
    if (value.length > MAX_PROMPT_CONTEXT_LEN) {
      return rejectPlanTripRequest(res, 400, `${field} is too long`, { code: "context_too_large" });
    }
  }

  // Mutate in place so downstream handlers see clipped answers (stop-report style).
  body.answers = sanitizeAnswersTree(answers);
  body.origin = origin.trim().slice(0, MAX_LOCATION_LEN);
  body.destination = destination.trim().slice(0, MAX_LOCATION_LEN);

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
