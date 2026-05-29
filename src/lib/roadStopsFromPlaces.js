/** Build road stop suggestions exclusively from Google Places along the route polyline. */
import { sampleRoutePointsEveryMiles } from "./fuel.js";
import { getFuelStopMode } from "./fuel.js";
import { searchNearbyCategory, getPlaceDetails } from "./placesSearch.js";
import { searchGasStations } from "./placesStations.js";
import { parseMilesFromDistance } from "./parsing.js";

const GENERAL_SEARCHES = [
  { type: "restaurant", keyword: "restaurant", category: "food" },
  { type: "cafe", keyword: "cafe", category: "food" },
  { type: "tourist_attraction", keyword: "attraction", category: "discovery" },
  { type: "park", keyword: "scenic stop", category: "rest" },
  { type: "bakery", keyword: "bakery", category: "food" },
];

async function pickUniquePhoto(placeId, usedPhotoUrls) {
  if (!placeId) return null;
  const details = await getPlaceDetails(placeId);
  const photos = details?.photos || [];
  for (const photo of photos) {
    const url = photo.getUrl?.({ maxWidth: 480 });
    if (url && !usedPhotoUrls.has(url)) {
      usedPhotoUrls.add(url);
      return url;
    }
  }
  return null;
}

function roadStopFromPlace(place, category, distanceLabel, photoUrl) {
  return {
    id: place.placeId || place.id,
    placeId: place.placeId || place.place_id || place.id,
    location: place.address?.split(",")[0]?.trim() || "Along route",
    distance: distanceLabel,
    eta: "—",
    category,
    name: place.name,
    note: place.rating ? `${place.rating} / 5` : "",
    lat: place.lat,
    lng: place.lng,
    photoUrl: photoUrl || null,
    rating: place.rating,
    distanceMiles: place.distanceMiles,
    detourMiles: place.isDetour ? place.detourMiles : undefined,
  };
}

async function searchAtSample(pt, sampleIndex, answers, fuelMode) {
  const searches = [...GENERAL_SEARCHES];
  if (fuelMode !== "none") {
    searches.unshift({ fuel: true, category: "fuel" });
  }
  const pick = searches[sampleIndex % searches.length];

  if (pick.fuel) {
    const gasList = await searchGasStations(pt.lat, pt.lng, 5, 1609);
    return gasList.map(g => ({ ...g, category: "fuel" }));
  }

  return searchNearbyCategory(pt.lat, pt.lng, {
    type: pick.type,
    keyword: pick.keyword,
    radius: 1609,
    maxResults: 8,
  }).then(list => list.map(p => ({ ...p, category: pick.category })));
}

import { dedupePlaces, placeDedupKey } from "./placesDedup.js";

export async function buildRoadStopsFromRoute(answers, routeInfo) {
  if (!routeInfo?.routePoints?.length || !window.google?.maps?.places) return [];

  const samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, 30);
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  const fuelMode = getFuelStopMode(answers);
  const stops = [];
  const seenKeys = new Set();
  const usedPhotoUrls = new Set();

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    if (!pt?.lat) continue;

    const mileLabel = totalMiles
      ? `${Math.round((i / Math.max(1, samples.length - 1)) * totalMiles)} mi`
      : "—";

    const candidates = await searchAtSample(pt, i, answers, fuelMode);
    const place = candidates.find(p => {
      const key = placeDedupKey(p);
      if (!key || seenKeys.has(key)) return false;
      return (p.distanceMiles ?? 99) <= 1;
    });
    if (!place) continue;

    const key = placeDedupKey(place);
    if (key) seenKeys.add(key);
    const photoUrl = await pickUniquePhoto(place.placeId || place.id, usedPhotoUrls);
    stops.push(roadStopFromPlace(place, place.category || "discovery", mileLabel, photoUrl));
  }

  return dedupePlaces(stops).slice(0, 12);
}
