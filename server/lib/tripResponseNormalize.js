/** Coerce common Sonnet JSON schema drift without failing the whole parse. */

const TOP_LEVEL_SCHEMA = {
  trip_format: "string",
  route_summary: "string",
  tips: "array",
  road_condition_warnings: "array",
  road_stops: "array",
  stops: "array",
  recommendations: "array",
  personal_touches: "array",
  changes_made: "array",
  truck_safe_route: "boolean",
};

const GENERIC_NAME_RE = /^(category|stop city|from placescontext|restaurant in|sit-down|quick option|second option|third option|airport|port|marina)/i;

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

function normalizeNameKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function collectVerifiedPlaceNames(placesContext) {
  const names = new Set();
  if (!placesContext || typeof placesContext !== "object") return names;

  const add = (item) => {
    const key = normalizeNameKey(item?.name);
    if (key.length >= 4) names.add(key);
  };

  placesContext.corridor?.forEach((seg) => {
    seg.gasStations?.forEach(add);
    seg.evStations?.forEach(add);
    seg.restaurants?.forEach(add);
    seg.playgrounds?.forEach(add);
    seg.prayerFacilities?.forEach(add);
  });
  placesContext.cities?.forEach((city) => {
    city.hotels?.forEach(add);
    city.dietaryRestaurants?.forEach(add);
    const medical = city.medical || {};
    Object.values(medical).flat().forEach(add);
  });
  return names;
}

export function nameMatchesVerifiedPlace(name, verifiedNames) {
  const key = normalizeNameKey(name);
  if (!key || key.length < 4 || GENERIC_NAME_RE.test(String(name || "").trim())) return false;
  if (verifiedNames.has(key)) return true;
  for (const verified of verifiedNames) {
    if (key.includes(verified) || verified.includes(key)) return true;
  }
  return false;
}

function inferPriceBandFromPrice(priceStr) {
  const m = String(priceStr || "").match(/(\d+)/);
  if (!m) return null;
  const nightly = parseInt(m[1], 10);
  if (nightly < 80) return "budget";
  if (nightly < 200) return "mid";
  return "luxury";
}

function verifyNamedItem(item, verifiedNames, { isRestaurant = false } = {}) {
  if (!item || typeof item !== "object") return item;
  const out = { ...item };
  const name = out.name;
  if (!name || GENERIC_NAME_RE.test(String(name).trim())) {
    out.verified = false;
    if (isRestaurant && !out.verification_note) {
      out.verification_note = "No verified name in placesContext";
    }
    return out;
  }
  const matches = nameMatchesVerifiedPlace(name, verifiedNames);
  if (out.verified === undefined) {
    out.verified = matches;
  } else {
    out.verified = toBooleanValue(out.verified) && matches;
  }
  if (isRestaurant && !out.verified && !out.verification_note) {
    out.verification_note = "Not in VERIFIED PLACES list";
  }
  if (out.verified && out.verification_note) {
    delete out.verification_note;
  }
  if (!out.price_band && out.price) {
    out.price_band = inferPriceBandFromPrice(out.price);
  }
  if (out.truck_parking !== undefined) {
    out.truck_parking = toBooleanValue(out.truck_parking);
  }
  return out;
}

function normalizeStopItem(stop, verifiedNames) {
  if (!stop || typeof stop !== "object") return stop;
  const out = { ...stop };
  for (const key of ["city", "distance", "eta", "why", "type", "scenicView", "coordinationNote"]) {
    if (out[key] != null && typeof out[key] !== "string") {
      out[key] = toStringValue(out[key]);
    }
  }
  if (out.hotels != null && !Array.isArray(out.hotels)) out.hotels = toArrayValue(out.hotels);
  if (out.restaurants != null && !Array.isArray(out.restaurants)) out.restaurants = toArrayValue(out.restaurants);
  if (out.motels != null && !Array.isArray(out.motels)) out.motels = toArrayValue(out.motels);
  if (out.fuelStops != null && !Array.isArray(out.fuelStops)) out.fuelStops = toArrayValue(out.fuelStops);

  if (Array.isArray(out.hotels)) {
    out.hotels = out.hotels.map(h => verifyNamedItem(h, verifiedNames));
  }
  if (Array.isArray(out.motels)) {
    out.motels = out.motels.map(m => verifyNamedItem(m, verifiedNames));
  }
  if (Array.isArray(out.restaurants)) {
    out.restaurants = out.restaurants.map(r => verifyNamedItem(r, verifiedNames, { isRestaurant: true }));
  }
  if (out.truckStop) out.truckStop = verifyNamedItem(out.truckStop, verifiedNames);
  if (out.rvPark) out.rvPark = verifyNamedItem(out.rvPark, verifiedNames);
  if (out.campground) out.campground = verifyNamedItem(out.campground, verifiedNames);
  return out;
}

function normalizeRoadStopItem(stop, verifiedNames) {
  if (!stop || typeof stop !== "object") return stop;
  const out = normalizeStopItem(stop, verifiedNames);
  if (out.name) {
    out.verified = nameMatchesVerifiedPlace(out.name, verifiedNames);
  } else {
    out.verified = false;
  }
  if (out.truck_parking !== undefined) {
    out.truck_parking = toBooleanValue(out.truck_parking);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} parsed
 * @param {{ placesContext?: object }} [options]
 * @returns {Record<string, unknown>}
 */
export function normalizeTripResponse(parsed, options = {}) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Trip response must be a JSON object");
  }

  const verifiedNames = collectVerifiedPlaceNames(options.placesContext);
  const out = { ...parsed };

  for (const [field, expectedType] of Object.entries(TOP_LEVEL_SCHEMA)) {
    if (out[field] !== undefined) {
      out[field] = coerceField(out[field], expectedType);
    }
  }

  if (Array.isArray(out.stops)) {
    out.stops = out.stops.map(s => normalizeStopItem(s, verifiedNames));
  }
  if (Array.isArray(out.road_stops)) {
    out.road_stops = out.road_stops.map(s => normalizeRoadStopItem(s, verifiedNames));
  }
  if (Array.isArray(out.recommendations)) {
    out.recommendations = out.recommendations.map(r => verifyNamedItem(r, verifiedNames));
  }

  return out;
}
