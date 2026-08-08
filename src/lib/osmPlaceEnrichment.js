/** Resolve unnamed OSM POIs and enforce verified Google Details before display. */
import { fetchPlaceDetailsCached } from "./placesDetailsClient.js";
import { resolvePlaceAtLocation } from "./placesResolveClient.js";
import { recordDetailsCall } from "./placesBudget.js";
import { isGooglePlaceId } from "./photoDisplayPolicy.js";

const RESOLVE_CFG = {
  fuel: { type: "gas_station", keyword: "gas station" },
  food: { type: "restaurant", keyword: "restaurant" },
  restaurant: { type: "restaurant", keyword: "restaurant" },
  lodging: { type: "lodging", keyword: "hotel" },
  truck_stop: { keyword: "truck stop travel plaza" },
  discovery: { type: "tourist_attraction", keyword: "point of interest" },
  cafe: { type: "cafe", keyword: "cafe" },
  rest_area: { keyword: "rest area highway" },
  services: { keyword: "travel plaza services" },
  park: { type: "park", keyword: "park" },
  bakery: { type: "bakery", keyword: "bakery" },
};

export function isVerifiedPlaceName(name) {
  const n = typeof name === "string" ? name.trim() : "";
  return n.length > 0 && n !== "Place";
}

function resolveConfig(category) {
  return RESOLVE_CFG[category] || RESOLVE_CFG.discovery;
}

function photoUrlFromReference(photoReference, maxWidth = 480) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!photoReference || !key) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${key}`;
}

function mergeDetailsIntoPlace(place, details, { includePhotos = true } = {}) {
  if (!details) return null;
  const photoReference = includePhotos
    ? (details.photoReference ?? place.photoReference ?? null)
    : null;
  return {
    ...place,
    placeId: details.placeId || place.placeId,
    name: details.name,
    rating: details.rating ?? place.rating ?? null,
    photoReference,
    photoUrl: includePhotos
      ? (photoUrlFromReference(photoReference) || place.photoUrl || null)
      : null,
    priceLevel: details.priceLevel ?? place.priceLevel ?? null,
    source: "google",
  };
}

/**
 * Targeted resolve at OSM coordinates.
 * When placeId is known, server skips Nearby and goes straight to Details.
 * When skipPhotos (preferFallback), Nearby fields may satisfy name/rating without Details.
 */
export async function resolveOsmAtCoordinates(
  lat,
  lng,
  category = "discovery",
  osmId = null,
  {
    placeId = null,
    skipPhotos = false,
  } = {},
) {
  if (lat == null || lng == null) {
    if (!placeId) return null;
  }
  const cfg = resolveConfig(category);
  const { details, cached, detailsSkipped } = await resolvePlaceAtLocation({
    lat,
    lng,
    type: cfg.type || null,
    keyword: cfg.keyword || null,
    osmId: osmId || null,
    placeId: placeId || null,
    skipPhotos,
  });
  if (!details?.placeId || !isVerifiedPlaceName(details.name)) return null;
  if (!cached && !detailsSkipped) recordDetailsCall();
  return details;
}

/**
 * Ensure a candidate has a verified name and Details enrichment (photo, rating).
 * Returns null when the place cannot be verified — never returns generic labels.
 * Pass skipPhotos only for RoadStopCard preferFallback paths — other callers need photos.
 */
export async function ensureNamedEnrichedPlace(place, displayCategory, {
  skipPhotos: skipPhotosOpt = null,
} = {}) {
  if (!place || (place.lat == null && !isGooglePlaceId(place.placeId))) return null;
  if (place.lat == null || place.lng == null) {
    if (!isGooglePlaceId(place.placeId)) return null;
  }

  const category = displayCategory || place.category || "discovery";
  const working = { ...place };
  const skipPhotos = skipPhotosOpt === true;
  const knownId = isGooglePlaceId(working.placeId) ? String(working.placeId).trim() : null;

  // Known place_id → Details only (never Nearby). Still resolve for OSM map refresh if osmId set.
  if (knownId) {
    const resolved = await resolveOsmAtCoordinates(
      working.lat,
      working.lng,
      category,
      working.osmId || null,
      { placeId: knownId, skipPhotos },
    );
    if (!resolved) return null;
    return mergeDetailsIntoPlace(working, resolved, { includePhotos: !skipPhotos });
  }

  const needsResolve = !isVerifiedPlaceName(working.name)
    || working.source === "osm"
    || !working.placeId;

  if (needsResolve) {
    const resolved = await resolveOsmAtCoordinates(
      working.lat,
      working.lng,
      category,
      working.osmId || null,
      { skipPhotos },
    );
    if (!resolved) return null;
    return mergeDetailsIntoPlace(working, resolved, { includePhotos: !skipPhotos });
  }

  if (!working.placeId || !isVerifiedPlaceName(working.name)) return null;

  // PreferFallback with verified name already — skip Details/Photo entirely when rating present.
  if (skipPhotos && working.rating != null) {
    return {
      ...working,
      photoReference: null,
      photoUrl: null,
      source: "google",
    };
  }

  const { details, cached } = await fetchPlaceDetailsCached(working.placeId, { skipPhotos });
  if (!details?.placeId || !isVerifiedPlaceName(details.name)) return null;
  if (!cached) recordDetailsCall();

  return mergeDetailsIntoPlace(working, details, { includePhotos: !skipPhotos });
}
