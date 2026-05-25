/** Build road stop suggestions exclusively from Google Places along the route polyline. */
import { sampleRoutePointsEveryMiles } from "./fuel.js";
import { getFuelStopMode } from "./fuel.js";
import { searchGasStations } from "./placesStations.js";
import { searchRestaurants, getPlaceDetails } from "./placesSearch.js";
import { parseMilesFromDistance } from "./parsing.js";

async function attachPhoto(place) {
  if (place.photoUrl || !place.placeId) return place;
  const details = await getPlaceDetails(place.placeId);
  const photo = details?.photos?.[0]?.getUrl?.({ maxWidth: 480 });
  return photo ? { ...place, photoUrl: photo } : place;
}

function roadStopFromPlace(place, category, distanceLabel) {
  return {
    id: place.placeId || place.id,
    placeId: place.placeId,
    location: place.address?.split(",")[0]?.trim() || "Along route",
    distance: distanceLabel,
    eta: "—",
    category,
    name: place.name,
    note: place.rating ? `${place.rating}★` : "",
    lat: place.lat,
    lng: place.lng,
    photoUrl: place.photoUrl || null,
    rating: place.rating,
    distanceMiles: place.distanceMiles,
    detourMiles: place.isDetour ? place.detourMiles : undefined,
  };
}

export async function buildRoadStopsFromRoute(answers, routeInfo) {
  if (!routeInfo?.routePoints?.length || !window.google?.maps?.places) return [];

  const samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, 30);
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  const fuelMode = getFuelStopMode(answers);
  const stops = [];
  const seen = new Set();

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    if (!pt?.lat) continue;
    const mileLabel = totalMiles
      ? `${Math.round((i / Math.max(1, samples.length - 1)) * totalMiles)} mi`
      : "—";

    if (fuelMode !== "none") {
      const gasList = await searchGasStations(pt.lat, pt.lng, 4, 1609);
      const gas = gasList.find(g => g.placeId && !seen.has(g.placeId) && (g.distanceMiles ?? 99) <= 1);
      if (gas) {
        seen.add(gas.placeId);
        const enriched = await attachPhoto(gas);
        stops.push(roadStopFromPlace(enriched, "fuel", mileLabel));
      }
    }

    if (i % 2 === 1 || samples.length <= 3) {
      const restaurants = await searchRestaurants(pt.lat, pt.lng, answers);
      const pick = restaurants.find(r => r.placeId && !seen.has(r.placeId) && (r.distanceMiles ?? 99) <= 1);
      if (pick) {
        seen.add(pick.placeId);
        const enriched = await attachPhoto(pick);
        stops.push(roadStopFromPlace(enriched, "food", `${pick.distanceMiles ?? "—"} mi`));
      }
    }
  }

  return stops.slice(0, 12);
}
