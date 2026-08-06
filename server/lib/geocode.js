/** Server-side geocoding via Google Geocoding + targeted Places Find Place. */
import { getGoogleMapsKey } from "./googleKey.js";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";

/** Landmark names that collide with unrelated businesses (art installation vs brewery). */
const LANDMARK_BREWERY_COLLISION_RE = /\bcadillac\s+ranch\b/i;
const BREWERY_RE = /\bbrew(?:ing|ery)\b/i;

/** Disambiguate business names that collide with famous landmarks (e.g. Cadillac Ranch art). */
export function buildBusinessGeocodeQuery(name, location = "") {
  const n = String(name || "").trim();
  const loc = String(location || "").trim();
  if (!n) return loc;
  let q = loc ? `${n}, ${loc}` : n;
  if (LANDMARK_BREWERY_COLLISION_RE.test(n) && BREWERY_RE.test(n)) {
    q = loc
      ? `${n} brewery restaurant, ${loc}`
      : `${n} brewery restaurant`;
  }
  return q.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
}

function needsLandmarkBreweryDisambiguation(address) {
  return LANDMARK_BREWERY_COLLISION_RE.test(address) && BREWERY_RE.test(address);
}

function resultFromGeocode(r) {
  if (!r?.geometry?.location) return null;
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address || null,
    placeId: r.place_id || null,
    types: Array.isArray(r.types) ? r.types : [],
    source: "geocode",
  };
}

function resultFromFindPlace(candidate) {
  if (!candidate?.geometry?.location) return null;
  return {
    lat: candidate.geometry.location.lat,
    lng: candidate.geometry.location.lng,
    formatted: candidate.formatted_address || candidate.name || null,
    placeId: candidate.place_id || null,
    types: Array.isArray(candidate.types) ? candidate.types : [],
    name: candidate.name || null,
    source: "find_place",
  };
}

function isTouristAttractionOnly(result) {
  const types = result?.types || [];
  if (!types.includes("tourist_attraction")) return false;
  return !types.some((t) => t === "brewery" || t === "bar" || t === "restaurant" || t === "food");
}

async function findPlaceFromText(key, input) {
  const params = new URLSearchParams({
    key,
    input,
    inputtype: "textquery",
    fields: "place_id,name,geometry,formatted_address,types",
  });
  const res = await fetch(`${FIND_PLACE_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.candidates?.[0]) return null;
  return resultFromFindPlace(data.candidates[0]);
}

async function geocodeRaw(key, address) {
  const params = new URLSearchParams({ key, address });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]) return null;
  return resultFromGeocode(data.results[0]);
}

/**
 * Geocode an address or business name.
 * For Cadillac Ranch + brewery queries, uses Places Find Place so the art
 * installation is not returned in place of the brewery.
 */
export async function geocodeAddress(address) {
  const key = getGoogleMapsKey();
  if (!key || !address) return null;

  const trimmed = String(address).trim();
  if (!trimmed) return null;

  if (needsLandmarkBreweryDisambiguation(trimmed)) {
    const disambiguated = buildBusinessGeocodeQuery(trimmed, "");
    const found = await findPlaceFromText(key, disambiguated);
    if (found && !isTouristAttractionOnly(found)) {
      return {
        lat: found.lat,
        lng: found.lng,
        formatted: found.formatted,
      };
    }
    const retry = await findPlaceFromText(
      key,
      "Cadillac Ranch Brewing Company brewery, Amarillo, TX",
    );
    if (retry && !isTouristAttractionOnly(retry)) {
      return {
        lat: retry.lat,
        lng: retry.lng,
        formatted: retry.formatted,
      };
    }
  }

  const geo = await geocodeRaw(key, trimmed);
  if (!geo) return null;

  // Last-chance: plain Geocode returned the art installation for a brewery query
  if (needsLandmarkBreweryDisambiguation(trimmed) && isTouristAttractionOnly(geo)) {
    const retry = await findPlaceFromText(
      key,
      buildBusinessGeocodeQuery(trimmed, ""),
    );
    if (retry && !isTouristAttractionOnly(retry)) {
      return {
        lat: retry.lat,
        lng: retry.lng,
        formatted: retry.formatted,
      };
    }
  }

  return {
    lat: geo.lat,
    lng: geo.lng,
    formatted: geo.formatted,
  };
}
