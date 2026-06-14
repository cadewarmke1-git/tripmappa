/** Build road stop suggestions from Google Places and OSM along the route polyline. */
import {
  sampleRoutePointsEveryMiles,
  getFuelStopMode,
  getPreferredFuelBrand,
  matchesPreferredFuelBrand,
} from "./fuel.js";
import { searchNearbyCategory, getPlaceDetails } from "./placesSearch.js";
import { searchGasStations } from "./placesStations.js";
import { parseMilesFromDistance } from "./parsing.js";
import { isTruckerTrip } from "./vehicles.js";
import { fetchRestStopsForBbox } from "./restStopsClient.js";
import { dedupePlaces, placeDedupKey } from "./placesDedup.js";

const GENERAL_SEARCHES = [
  { type: "restaurant", keyword: "restaurant", category: "food" },
  { type: "cafe", keyword: "cafe", category: "food" },
  { type: "tourist_attraction", keyword: "attraction", category: "discovery" },
  { type: "park", keyword: "scenic stop", category: "rest" },
  { type: "bakery", keyword: "bakery", category: "food" },
];

const CONTINUOUS_DRIVE_SEARCHES = [
  { type: "gas_station", keyword: "gas station", category: "fuel" },
  { fuel: true, category: "fuel" },
];

const HYBRID_PLACES_SEARCHES = [
  { type: "truck_stop", category: "truck_stop" },
  { type: "gas_station", keyword: "gas station", category: "fuel" },
  { keyword: "travel plaza", category: "rest" },
];

const SEGMENT_MILES = 30;
const OSM_DEDUPE_MILES = 0.5;
const PLACES_ROUTE_MILES = 1;

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function useHybridRestEnrichment(answers, continuousDrive) {
  return continuousDrive || isTruckerTrip(answers);
}

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
    source: "places",
  };
}

const OSM_TYPE_LABELS = {
  rest_area: "Highway Rest Area",
  truck_stop: "Truck Stop",
  services: "Services Area",
};

function roadStopFromOsm(osm, distanceLabel, distanceMiles) {
  const amenities = Array.isArray(osm.amenities) ? osm.amenities : [];
  return {
    id: osm.id,
    location: "Along route",
    distance: distanceLabel,
    eta: "—",
    category: osm.type || "rest_area",
    name: osm.name || OSM_TYPE_LABELS[osm.type] || "Highway Rest Area",
    note: amenities.length ? amenities.join(", ") : "",
    lat: osm.lat,
    lng: osm.lon,
    photoUrl: null,
    rating: null,
    distanceMiles,
    amenities,
    source: "osm",
  };
}

function mileLabelForFraction(fraction, totalMiles) {
  if (!totalMiles) return "—";
  return `${Math.round(fraction * totalMiles)} mi`;
}

function closestRouteFraction(lat, lng, routePoints) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < routePoints.length; i++) {
    const pt = routePoints[i];
    if (pt?.lat == null || pt?.lng == null) continue;
    const d = haversineMiles(lat, lng, pt.lat, pt.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return {
    fraction: bestIdx / Math.max(1, routePoints.length - 1),
    distanceMiles: Math.round(bestDist * 10) / 10,
  };
}

function bboxForPoints(points) {
  let north = -90;
  let south = 90;
  let east = -180;
  let west = 180;
  for (const pt of points) {
    if (pt?.lat == null || pt?.lng == null) continue;
    north = Math.max(north, pt.lat);
    south = Math.min(south, pt.lat);
    east = Math.max(east, pt.lng);
    west = Math.min(west, pt.lng);
  }
  if (north <= south || east <= west) return null;
  return { north, south, east, west };
}

function buildRouteSegments(routePoints, totalMiles) {
  if (!routePoints?.length) return [];
  const miles = totalMiles || routePoints.length;
  const segmentCount = Math.max(1, Math.ceil(miles / SEGMENT_MILES));
  const segments = [];

  for (let i = 0; i < segmentCount; i++) {
    const startFrac = i / segmentCount;
    const endFrac = (i + 1) / segmentCount;
    const startIdx = Math.floor(startFrac * (routePoints.length - 1));
    const endIdx = Math.min(routePoints.length - 1, Math.ceil(endFrac * (routePoints.length - 1)));
    const slice = routePoints.slice(startIdx, endIdx + 1);
    const bbox = bboxForPoints(slice);
    if (!bbox) continue;
    segments.push({
      startFrac,
      endFrac,
      bbox,
      points: slice,
    });
  }
  return segments;
}

function isPlaceInSegment(place, segment, routePoints) {
  if (place.lat == null || place.lng == null) return false;
  const { fraction } = closestRouteFraction(place.lat, place.lng, routePoints);
  return fraction >= segment.startFrac - 0.02 && fraction <= segment.endFrac + 0.02;
}

function countPlacesInSegment(places, segment, routePoints) {
  return places.filter(p => isPlaceInSegment(p, segment, routePoints)).length;
}

function isNearAnyPlace(osm, places, thresholdMiles = OSM_DEDUPE_MILES) {
  if (osm.lat == null || osm.lon == null) return false;
  return places.some(p => {
    if (p.lat == null || p.lng == null) return false;
    return haversineMiles(osm.lat, osm.lon, p.lat, p.lng) <= thresholdMiles;
  });
}

async function searchHybridPlacesAtSample(pt) {
  const merged = new Map();
  await Promise.all(HYBRID_PLACES_SEARCHES.map(async (search) => {
    const list = await searchNearbyCategory(pt.lat, pt.lng, {
      type: search.type,
      keyword: search.keyword,
      radius: 1609,
      maxResults: 8,
    });
    list.forEach((place) => {
      const key = placeDedupKey(place);
      if (!key || merged.has(key)) return;
      merged.set(key, { ...place, category: search.category });
    });
  }));
  return [...merged.values()];
}

async function searchAtSample(pt, sampleIndex, answers, fuelMode, continuousDrive) {
  const searches = continuousDrive
    ? [...CONTINUOUS_DRIVE_SEARCHES]
    : [...GENERAL_SEARCHES];
  if (fuelMode !== "none" && !continuousDrive) {
    searches.unshift({ fuel: true, category: "fuel" });
  }
  const pick = searches[sampleIndex % searches.length];

  if (pick.fuel) {
    const gasList = await searchGasStations(pt.lat, pt.lng, 8, 1609);
    const brand = getPreferredFuelBrand(answers);
    const filtered = brand
      ? gasList.filter(g => matchesPreferredFuelBrand(g.name, brand))
      : gasList;
    return filtered.map(g => ({ ...g, category: "fuel" }));
  }

  return searchNearbyCategory(pt.lat, pt.lng, {
    type: pick.type,
    keyword: pick.keyword,
    radius: 1609,
    maxResults: 8,
  }).then(list => list.map(p => ({ ...p, category: pick.category })));
}

async function buildHybridRoadStops(answers, routeInfo, options) {
  const { continuousDrive, totalMiles, maxStops, fuelMode } = options;
  const routePoints = routeInfo.routePoints;
  const sampleInterval = continuousDrive ? 20 : 30;
  const samples = sampleRoutePointsEveryMiles(routePoints, sampleInterval);
  const placesCollected = [];
  const seenKeys = new Set();
  const usedPhotoUrls = new Set();
  const stops = [];

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    if (!pt?.lat) continue;

    const hybridCandidates = await searchHybridPlacesAtSample(pt);
    const fuelCandidates = await searchAtSample(pt, i, answers, fuelMode, continuousDrive);
    const candidates = [...hybridCandidates, ...fuelCandidates];

    for (const place of candidates) {
      const key = placeDedupKey(place);
      if (!key || seenKeys.has(key)) continue;
      if ((place.distanceMiles ?? 99) > PLACES_ROUTE_MILES) continue;
      seenKeys.add(key);
      placesCollected.push(place);
    }
  }

  const segments = buildRouteSegments(routePoints, totalMiles);
  const vehicleType = answers?.vehicle || null;
  const osmCollected = [];

  for (const segment of segments) {
    if (countPlacesInSegment(placesCollected, segment, routePoints) >= 2) continue;
    const { stops: osmStops } = await fetchRestStopsForBbox({
      bbox: segment.bbox,
      vehicleType,
    });
    for (const osm of osmStops || []) {
      if (isNearAnyPlace(osm, placesCollected)) continue;
      if (osmCollected.some(existing => existing.id === osm.id)) continue;
      osmCollected.push(osm);
    }
  }

  for (const place of placesCollected) {
    const { fraction, distanceMiles } = closestRouteFraction(place.lat, place.lng, routePoints);
    const mileLabel = mileLabelForFraction(fraction, totalMiles);
    const photoUrl = await pickUniquePhoto(place.placeId || place.id, usedPhotoUrls);
    stops.push(roadStopFromPlace(place, place.category || "fuel", mileLabel, photoUrl));
    if (place.distanceMiles == null) {
      stops[stops.length - 1].distanceMiles = distanceMiles;
    }
  }

  for (const osm of osmCollected) {
    const { fraction, distanceMiles } = closestRouteFraction(osm.lat, osm.lon, routePoints);
    const mileLabel = mileLabelForFraction(fraction, totalMiles);
    stops.push(roadStopFromOsm(osm, mileLabel, distanceMiles));
  }

  return dedupePlaces(stops).slice(0, maxStops);
}

export async function buildRoadStopsFromRoute(answers, routeInfo) {
  if (!routeInfo?.routePoints?.length || !window.google?.maps?.places) return [];

  const continuousDrive = answers?.continuous_drive === true
    || answers?.overnight_preference === "Drive straight through";
  const sampleInterval = continuousDrive ? 20 : 30;
  const maxStops = continuousDrive ? 16 : 12;
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  const fuelMode = getFuelStopMode(answers);

  if (useHybridRestEnrichment(answers, continuousDrive)) {
    return buildHybridRoadStops(answers, routeInfo, {
      continuousDrive,
      totalMiles,
      maxStops,
      fuelMode,
    });
  }

  const samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, sampleInterval);
  const stops = [];
  const seenKeys = new Set();
  const usedPhotoUrls = new Set();

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    if (!pt?.lat) continue;

    const mileLabel = totalMiles
      ? `${Math.round((i / Math.max(1, samples.length - 1)) * totalMiles)} mi`
      : "—";

    const candidates = await searchAtSample(pt, i, answers, fuelMode, continuousDrive);
    const place = candidates.find(p => {
      const key = placeDedupKey(p);
      if (!key || seenKeys.has(key)) return false;
      return (p.distanceMiles ?? 99) <= PLACES_ROUTE_MILES;
    });
    if (!place) continue;

    const key = placeDedupKey(place);
    if (key) seenKeys.add(key);
    const photoUrl = await pickUniquePhoto(place.placeId || place.id, usedPhotoUrls);
    stops.push(roadStopFromPlace(place, place.category || "discovery", mileLabel, photoUrl));
  }

  return dedupePlaces(stops).slice(0, maxStops);
}
