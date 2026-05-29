/** Shared deduplication for Google Places results across enrichment and route stops. */
export function normalizePlaceName(name) {
  return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export function placeDedupKey(place) {
  const id = place?.placeId || place?.id;
  if (id) return `id:${id}`;
  const name = normalizePlaceName(place?.name || place?.title);
  const lat = place?.lat ?? place?.stopData?.lat;
  const lng = place?.lng ?? place?.stopData?.lng;
  if (name && lat != null && lng != null) {
    return `geo:${name}:${Math.round(lat * 100)}:${Math.round(lng * 100)}`;
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
