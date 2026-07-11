/** Resolve unnamed OSM POIs and enforce verified Google Details before display. */
import { fetchPlaceDetailsCached } from "./placesDetailsClient.js";
import { resolvePlaceAtLocation } from "./placesResolveClient.js";
import { recordDetailsCall } from "./placesBudget.js";

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

function mergeDetailsIntoPlace(place, details) {
  if (!details) return null;
  return {
    ...place,
    placeId: details.placeId || place.placeId,
    name: details.name,
    rating: details.rating ?? place.rating ?? null,
    photoReference: details.photoReference ?? place.photoReference ?? null,
    photoUrl: photoUrlFromReference(details.photoReference) || place.photoUrl || null,
    priceLevel: details.priceLevel ?? place.priceLevel ?? null,
    source: "google",
  };
}

/** Targeted Nearby + Details at OSM coordinates when name or placeId is missing. */
export async function resolveOsmAtCoordinates(lat, lng, category = "discovery") {
  if (lat == null || lng == null) return null;
  const cfg = resolveConfig(category);
  const { details, cached } = await resolvePlaceAtLocation({
    lat,
    lng,
    type: cfg.type || null,
    keyword: cfg.keyword || null,
  });
  if (!details?.placeId || !isVerifiedPlaceName(details.name)) return null;
  if (!cached) recordDetailsCall();
  return details;
}

/**
 * Ensure a candidate has a verified name and Details enrichment (photo, rating).
 * Returns null when the place cannot be verified — never returns generic labels.
 */
export async function ensureNamedEnrichedPlace(place, displayCategory) {
  if (!place || place.lat == null || place.lng == null) return null;

  const category = displayCategory || place.category || "discovery";
  let working = { ...place };

  const needsResolve = !isVerifiedPlaceName(working.name)
    || working.source === "osm"
    || !working.placeId;

  if (needsResolve) {
    const resolved = await resolveOsmAtCoordinates(working.lat, working.lng, category);
    if (!resolved) return null;
    return mergeDetailsIntoPlace(working, resolved);
  }

  if (!working.placeId || !isVerifiedPlaceName(working.name)) return null;

  const { details, cached } = await fetchPlaceDetailsCached(working.placeId);
  if (!details?.placeId || !isVerifiedPlaceName(details.name)) return null;
  if (!cached) recordDetailsCall();

  return mergeDetailsIntoPlace(working, details);
}
