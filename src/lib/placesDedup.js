/** Shared deduplication for Google Places results across enrichment and route stops. */
export function normalizePlaceName(name) {
  return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Google Places place_id (or equivalent id fields on road stop objects). */
export function placeGoogleId(place) {
  if (!place) return null;
  return (
    place.place_id
    || place.placeId
    || place.stopData?.place_id
    || place.stopData?.placeId
    || null
  );
}

export function placeDisplayName(place) {
  return place?.name || place?.title || place?.stopData?.name || "";
}

export function placeCoordinates(place) {
  const lat = place?.lat ?? place?.stopData?.lat;
  const lng = place?.lng ?? place?.stopData?.lng;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

export function placeDedupKey(place) {
  const googleId = placeGoogleId(place);
  if (googleId) return `place_id:${googleId}`;

  const name = normalizePlaceName(placeDisplayName(place));
  const coords = placeCoordinates(place);
  if (name && coords) {
    return `geo:${name}:${coords.lat.toFixed(3)}:${coords.lng.toFixed(3)}`;
  }
  return name ? `name:${name}` : null;
}

const GENERIC_STOP_NAMES = new Set(["road stop", "stop", "along route"]);

export function coordsNear(a, b, thresholdDeg = 0.002) {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) <= thresholdDeg && Math.abs(a.lng - b.lng) <= thresholdDeg;
}

/** True when two place/stop objects refer to the same location (place_id or name+coords). */
export function placesMatch(a, b) {
  if (!a || !b) return false;

  const idA = placeGoogleId(a);
  const idB = placeGoogleId(b);
  if (idA && idB && idA === idB) return true;

  const keyA = placeDedupKey(a);
  const keyB = placeDedupKey(b);
  if (keyA && keyB && keyA === keyB) return true;

  const nameA = normalizePlaceName(placeDisplayName(a));
  const nameB = normalizePlaceName(placeDisplayName(b));
  if (!nameA || !nameB || nameA !== nameB) return false;
  if (GENERIC_STOP_NAMES.has(nameA)) return false;

  const coordsA = placeCoordinates(a);
  const coordsB = placeCoordinates(b);
  if (coordsA && coordsB) return coordsNear(coordsA, coordsB);
  return false;
}

export function dedupePlaces(places = []) {
  const out = [];
  for (const place of places) {
    if (out.some(existing => placesMatch(existing, place))) continue;
    out.push(place);
  }
  return out;
}

/** Explicit alias for road stop arrays before they reach the UI. */
export const dedupeRoadStops = dedupePlaces;
