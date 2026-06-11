/** Coerce common Sonnet JSON schema drift without failing the whole parse. */
import { normalizeTripTips } from "./tripTips.js";
import {
  FOOD_SERVING_TYPES,
  LODGING_TYPES,
  NON_FOOD_PRIMARY_TYPES,
  placeTypes,
} from "../../src/lib/placesFilters.js";

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
const NON_FOOD_NAME_RE = /\b(ford|dealership|dealer|hotel|motel|inn\b|marriott|hilton|hyatt|hampton|holiday inn|comfort inn)\b/i;
const PLANNING_VOCAB_RE = /\([^)]*corridor\s+vicinity[^)]*\)|\bcorridor\b|\bvicinity\b/gi;

export function stripPlanningVocabularyFromName(name) {
  if (!name) return name;
  return String(name)
    .replace(PLANNING_VOCAB_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

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
  return new Set(collectPlacesContextIndex(placesContext).keys());
}

/** @returns {Map<string, { name: string, types: string[], rating?: number, userRatingsTotal?: number }>} */
export function collectPlacesContextIndex(placesContext) {
  const index = new Map();
  if (!placesContext || typeof placesContext !== "object") return index;

  const add = (item) => {
    const key = normalizeNameKey(item?.name);
    if (key.length < 4) return;
    index.set(key, {
      name: item.name,
      types: placeTypes(item),
      rating: item.rating,
      userRatingsTotal: item.userRatingsTotal,
    });
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
  return index;
}

function lookupPlaceMatch(name, index) {
  const key = normalizeNameKey(name);
  if (!key || key.length < 4) return null;
  if (index.has(key)) return index.get(key);
  for (const [verifiedKey, data] of index.entries()) {
    if (key.includes(verifiedKey) || verifiedKey.includes(key)) return data;
  }
  return null;
}

function isFoodCategory(value) {
  return /food|restaurant|dining|meal|eat|cafe|bakery/i.test(String(value || ""));
}

function isLodgingCategory(value) {
  return /hotel|lodging|motel|overnight|stay/i.test(String(value || ""));
}

function typesIndicateFood(types = []) {
  return types.some(t => FOOD_SERVING_TYPES.has(t));
}

function typesIndicateLodging(types = []) {
  return types.some(t => LODGING_TYPES.has(t));
}

function typesRejectFood(types = []) {
  const primary = types[0];
  return primary && NON_FOOD_PRIMARY_TYPES.has(primary) && !typesIndicateFood(types);
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

function sanitizeDisplayName(name) {
  return stripPlanningVocabularyFromName(name);
}

function applyPlacesEnrichment(item, placeMatch) {
  if (!item || !placeMatch) return item;
  const out = { ...item };
  if (placeMatch.rating != null && out.rating == null) out.rating = placeMatch.rating;
  if (placeMatch.userRatingsTotal != null && out.userRatingsTotal == null) {
    out.userRatingsTotal = placeMatch.userRatingsTotal;
  }
  if (placeMatch.types?.length && !out.types?.length) out.types = placeMatch.types;
  return out;
}

function verifyNamedItem(item, verifiedNames, { isRestaurant = false, placesIndex = null } = {}) {
  if (!item || typeof item !== "object") return item;
  let out = { ...item };
  if (out.name) out.name = sanitizeDisplayName(out.name);
  const name = out.name;
  const placeMatch = placesIndex ? lookupPlaceMatch(name, placesIndex) : null;
  if (placeMatch) out = applyPlacesEnrichment(out, placeMatch);
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
  if (!placeMatch?.pricePerNight && !out.priceSource) {
    delete out.price;
    out.priceIsEstimated = true;
  }
  if (out.truck_parking !== undefined) {
    out.truck_parking = toBooleanValue(out.truck_parking);
  }
  return out;
}

function reconcileFoodLodgingCategory(item, placesIndex, log) {
  if (!item || !placesIndex?.size) return item;
  const out = { ...item };
  const name = out.name || out.location;
  const match = lookupPlaceMatch(name, placesIndex);
  if (!match?.types?.length) return out;

  const category = out.category || out.type;
  const foodSlot = isFoodCategory(category) || Array.isArray(out.restaurants);
  const lodgingTypes = typesIndicateLodging(match.types);
  const foodTypes = typesIndicateFood(match.types);

  if (foodSlot && lodgingTypes && !foodTypes) {
    log.push(`Category fix: "${name}" moved from food to lodging (types: ${match.types.join(", ")})`);
    out.category = "lodging";
    out.type = "lodging";
    if (!Array.isArray(out.hotels)) out.hotels = [];
    const hotelEntry = {
      name: sanitizeDisplayName(name),
      verified: nameMatchesVerifiedPlace(name, new Set(placesIndex.keys())),
      price_band: out.price_band,
    };
    if (!out.hotels.some(h => normalizeNameKey(h?.name) === normalizeNameKey(name))) {
      out.hotels.push(hotelEntry);
    }
    if (Array.isArray(out.restaurants)) {
      out.restaurants = out.restaurants.filter(r => normalizeNameKey(r?.name) !== normalizeNameKey(name));
    }
  } else if (foodSlot && typesRejectFood(match.types)) {
    log.push(`Category fix: dropped non-food "${name}" from food slot (types: ${match.types.join(", ")})`);
    return null;
  }
  return out;
}

function normalizeStopItem(stop, verifiedNames, placesIndex, log = []) {
  if (!stop || typeof stop !== "object") return stop;
  const out = { ...stop };
  if (out.city) out.city = sanitizeDisplayName(out.city);
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
    out.hotels = out.hotels.map(h => verifyNamedItem(h, verifiedNames, { placesIndex }));
  }
  if (Array.isArray(out.motels)) {
    out.motels = out.motels.map(m => verifyNamedItem(m, verifiedNames, { placesIndex }));
  }
  if (Array.isArray(out.restaurants)) {
    out.restaurants = out.restaurants
      .map(r => verifyNamedItem(r, verifiedNames, { isRestaurant: true, placesIndex }))
      .filter(r => {
        const match = lookupPlaceMatch(r?.name, placesIndex);
        if (!match?.types?.length) return true;
        if (typesIndicateLodging(match.types) && !typesIndicateFood(match.types)) {
          log.push(`Category fix: removed lodging "${r.name}" from restaurants list`);
          if (!Array.isArray(out.hotels)) out.hotels = [];
          out.hotels.push({
            ...r,
            verified: r.verified === true && nameMatchesVerifiedPlace(r.name, verifiedNames),
          });
          return false;
        }
        return !typesRejectFood(match.types);
      });
  }
  if (out.truckStop) out.truckStop = verifyNamedItem(out.truckStop, verifiedNames, { placesIndex });
  if (out.rvPark) out.rvPark = verifyNamedItem(out.rvPark, verifiedNames, { placesIndex });
  if (out.campground) out.campground = verifyNamedItem(out.campground, verifiedNames, { placesIndex });
  return reconcileFoodLodgingCategory(out, placesIndex, log) || out;
}

function normalizeRoadStopItem(stop, verifiedNames, placesIndex, log = []) {
  if (!stop || typeof stop !== "object") return stop;
  let out = normalizeStopItem(stop, verifiedNames, placesIndex, log);
  if (!out) return null;
  if (out.name) {
    out.name = sanitizeDisplayName(out.name);
    out.verified = nameMatchesVerifiedPlace(out.name, verifiedNames);
  } else {
    out.verified = false;
  }
  if (out.truck_parking !== undefined) {
    out.truck_parking = toBooleanValue(out.truck_parking);
  }
  if (isFoodCategory(out.category) && NON_FOOD_NAME_RE.test(String(out.name || ""))) {
    log.push(`Dropped non-food business "${out.name}" from food road_stop`);
    return null;
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

  const placesIndex = collectPlacesContextIndex(options.placesContext);
  const verifiedNames = new Set(placesIndex.keys());
  const categoryLog = [];
  const out = { ...parsed };

  for (const [field, expectedType] of Object.entries(TOP_LEVEL_SCHEMA)) {
    if (out[field] !== undefined) {
      out[field] = coerceField(out[field], expectedType);
    }
  }

  if (Array.isArray(out.stops)) {
    out.stops = out.stops
      .map(s => normalizeStopItem(s, verifiedNames, placesIndex, categoryLog))
      .filter(Boolean);
  }
  if (Array.isArray(out.road_stops)) {
    out.road_stops = out.road_stops
      .map(s => normalizeRoadStopItem(s, verifiedNames, placesIndex, categoryLog))
      .filter(Boolean);
  }
  if (Array.isArray(out.recommendations)) {
    out.recommendations = out.recommendations.map(r => verifyNamedItem(r, verifiedNames, { placesIndex }));
  }
  if (categoryLog.length) {
    console.info("[tripResponseNormalize] category corrections:", categoryLog);
  }
  if (out.tips !== undefined) {
    out.tips = normalizeTripTips(out.tips);
  }

  return out;
}
