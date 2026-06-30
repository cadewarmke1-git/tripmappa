/** Whether a stop/card is backed by live Google Places data (not invented or OSM-only). */
export function hasGooglePlacesData(record) {
  if (!record) return false;
  const data = record.stopData || record;
  if (data.source === "osm") return false;
  if (data.fromGooglePlaces === true) return true;
  const placeId = data.placeId || data.place_id;
  if (placeId && String(placeId).trim() && !/^osm/i.test(String(placeId))) {
    return true;
  }
  return data.verified === true;
}
