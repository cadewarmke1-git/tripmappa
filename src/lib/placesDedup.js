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

export function dedupePlaces(places = []) {
  const seen = new Set();
  return places.filter((place) => {
    const key = placeDedupKey(place);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Explicit alias for road stop arrays before they reach the UI. */
export const dedupeRoadStops = dedupePlaces;
