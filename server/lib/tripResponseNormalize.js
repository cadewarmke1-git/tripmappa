/** Coerce common Sonnet JSON schema drift without failing the whole parse. */

const TOP_LEVEL_SCHEMA = {
  trip_format: "string",
  route_summary: "string",
  tips: "array",
  road_condition_warnings: "array",
  road_stops: "array",
  stops: "array",
  recommendations: "array",
  truck_safe_route: "boolean",
};

function toStringValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toArrayValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value];
      }
    }
    return [value];
  }
  return [value];
}

function toBooleanValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|1)$/i.test(value.trim());
  return Boolean(value);
}

function toNumberValue(value) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^\d.-]/g, ""));
    return Number.isNaN(n) ? value : n;
  }
  return value;
}

function coerceField(value, expectedType) {
  if (value === undefined) return value;
  switch (expectedType) {
    case "string":
      return toStringValue(value);
    case "array":
      return toArrayValue(value);
    case "boolean":
      return toBooleanValue(value);
    case "number":
      return toNumberValue(value);
    default:
      return value;
  }
}

function normalizeStopItem(stop) {
  if (!stop || typeof stop !== "object") return stop;
  const out = { ...stop };
  for (const key of ["city", "distance", "eta", "why", "type", "scenicView", "coordinationNote"]) {
    if (out[key] != null && typeof out[key] !== "string") {
      out[key] = toStringValue(out[key]);
    }
  }
  if (out.hotels != null && !Array.isArray(out.hotels)) out.hotels = toArrayValue(out.hotels);
  if (out.restaurants != null && !Array.isArray(out.restaurants)) out.restaurants = toArrayValue(out.restaurants);
  if (out.fuelStops != null && !Array.isArray(out.fuelStops)) out.fuelStops = toArrayValue(out.fuelStops);
  return out;
}

/**
 * @param {Record<string, unknown>} parsed
 * @returns {Record<string, unknown>}
 */
export function normalizeTripResponse(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Trip response must be a JSON object");
  }

  const out = { ...parsed };

  for (const [field, expectedType] of Object.entries(TOP_LEVEL_SCHEMA)) {
    if (out[field] !== undefined) {
      out[field] = coerceField(out[field], expectedType);
    }
  }

  if (Array.isArray(out.stops)) {
    out.stops = out.stops.map(normalizeStopItem);
  }
  if (Array.isArray(out.road_stops)) {
    out.road_stops = out.road_stops.map(normalizeStopItem);
  }

  return out;
}
