/** When true, PlacePhotoOrIcon uses brand/category/icon — Google Places photos are never shown. */

/**
 * Mirrors RoadStopCard photo policy after enrichment (source becomes "google").
 * Fuel-family categories show real Places photos; everything else prefers fallback.
 */
export function prefersPhotoFallback(category, source = "google") {
  if (source === "osm") return true;
  const cat = String(category || "").toLowerCase();
  return !/fuel|gas|charg|truck|rest_area|diesel|ev/.test(cat);
}

/** Whether a place_id looks like a Google Places id (not OSM). */
export function isGooglePlaceId(placeId) {
  const id = placeId != null ? String(placeId).trim() : "";
  if (!id) return false;
  if (/^osm/i.test(id)) return false;
  return true;
}
