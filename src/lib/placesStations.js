function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapPlaceResult(place, originLat, originLng) {
  const lat = place.geometry?.location?.lat?.() ?? place.geometry?.location?.lat;
  const lng = place.geometry?.location?.lng?.() ?? place.geometry?.location?.lng;
  const distanceMiles = lat != null && lng != null
    ? Math.round(haversineMiles(originLat, originLng, lat, lng) * 10) / 10
    : null;
  return {
    id: place.place_id || `g-${lat}-${lng}`,
    placeId: place.place_id,
    name: place.name || "Station",
    address: place.vicinity || place.formatted_address || "Along route",
    lat,
    lng,
    distanceMiles,
    rating: place.rating,
    photoUrl: place.photos?.[0]?.getUrl?.({ maxWidth: 480 }) || null,
  };
}

function nearbySearch(request) {
  return new Promise((resolve) => {
    if (!window.google?.maps?.places) {
      resolve([]);
      return;
    }
    const container = document.createElement("div");
    const service = new window.google.maps.places.PlacesService(container);
    service.nearbySearch(request, (results, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });
}

/** Google Places nearby search — primary station location source. */
export async function searchNearbyStations(lat, lng, { type, keyword, maxResults = 10, radius = 8047 } = {}) {
  if (lat == null || lng == null) return [];
  const location = new window.google.maps.LatLng(lat, lng);
  const base = { location, radius };
  if (type) base.type = type;
  if (keyword) base.keyword = keyword;

  const results = await nearbySearch(base);
  return results
    .slice(0, maxResults)
    .map(p => mapPlaceResult(p, lat, lng))
    .filter(s => s.lat != null && s.lng != null);
}

export async function searchGasStations(lat, lng, maxResults = 10, radius = 8047) {
  return searchNearbyStations(lat, lng, { type: "gas_station", maxResults, radius });
}

export async function searchEvChargingStations(lat, lng, maxResults = 10, radius = 8047) {
  return searchNearbyStations(lat, lng, { type: "electric_vehicle_charging_station", maxResults, radius });
}

export async function searchPropaneStations(lat, lng, maxResults = 6) {
  return searchNearbyStations(lat, lng, { keyword: "propane refill", maxResults });
}

export async function searchDieselStations(lat, lng, maxResults = 10, radius = 8047) {
  const truckStops = await searchNearbyStations(lat, lng, { keyword: "truck stop diesel", maxResults: 6, radius });
  if (truckStops.length >= 3) return truckStops;
  const gas = await searchGasStations(lat, lng, maxResults, radius);
  return gas;
}
