/** Build road stop suggestions from OSM corridor data with Google gap-fill and display enrichment. */
import {
  sampleRoutePointsEveryMiles,
  getFuelStopMode,
  getPreferredFuelBrand,
  matchesPreferredFuelBrand,
} from "./fuel.js";
import { fetchPlacesNearbyCached } from "./placesCorridorClient.js";
import { parseMilesFromDistance } from "./parsing.js";
import { isTruckerTrip } from "./vehicles.js";
import { fetchRestStopsForBbox } from "./restStopsClient.js";
import { dedupePlaces, placeDedupKey } from "./placesDedup.js";
import { ensureNamedEnrichedPlace } from "./osmPlaceEnrichment.js";
import {
  DENSE_SAMPLE_INTERVAL_MI,
  hasOsmPoisNear,
  missingTruckBrandsInSegment,
  osmPlaceToCandidate,
  placesNearPoint,
  truckStopsFromOsm,
} from "./osmCorridorPlaces.js";

const DISCOVERY_OSM_CATEGORIES = {
  cafe: ["restaurant"],
  bakery: ["restaurant"],
};

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

const SEGMENT_MILES = 30;
const OSM_DEDUPE_MILES = 0.5;
const PLACES_ROUTE_MILES = 1;
const SAMPLE_INTERVAL_MI = DENSE_SAMPLE_INTERVAL_MI;
const CONTINUOUS_SAMPLE_INTERVAL_MI = 35;
const CONTEXT_MATCH_MILES = 2;

function findCorridorSegmentForPoint(placesContext, lat, lng) {
  const corridor = placesContext?.corridor;
  if (!corridor?.length || lat == null || lng == null) return null;
  let best = null;
  let bestDist = CONTEXT_MATCH_MILES;
  for (const seg of corridor) {
    if (seg.lat == null || seg.lng == null) continue;
    const d = haversineMiles(lat, lng, seg.lat, seg.lng);
    if (d < bestDist) {
      bestDist = d;
      best = seg;
    }
  }
  return best;
}

function compactPlaceToCandidate(compact, category) {
  if (!compact || compact.lat == null) return null;
  return {
    placeId: compact.placeId,
    osmId: compact.osmId,
    name: compact.name,
    address: compact.address,
    rating: compact.rating,
    lat: compact.lat,
    lng: compact.lng,
    distanceMiles: compact.distanceMi ?? compact.distanceMiles,
    category,
    source: compact.source || (compact.placeId ? "google" : "osm"),
    brandId: compact.brandId,
  };
}

function fuelCandidatesFromSegment(segment, answers) {
  if (!segment) return [];
  const brand = getPreferredFuelBrand(answers);
  const gas = (segment.gasStations || []).flatMap(g => {
    const candidate = compactPlaceToCandidate(g, "fuel");
    return candidate ? [candidate] : [];
  });
  const ev = (segment.evStations || []).flatMap(e => {
    const candidate = compactPlaceToCandidate(e, "fuel");
    return candidate ? [candidate] : [];
  });
  let combined = [...gas, ...ev];
  if (brand) {
    const named = combined.filter(g => g.name && matchesPreferredFuelBrand(g.name, brand));
    if (named.length) combined = named;
  }
  return combined.filter(p => (p.distanceMiles ?? 99) <= PLACES_ROUTE_MILES);
}

function foodCandidatesFromSegment(segment) {
  if (!segment) return [];
  return (segment.restaurants || []).flatMap(r => {
    const place = compactPlaceToCandidate(r, "food");
    return place && (place.distanceMiles ?? 99) <= PLACES_ROUTE_MILES ? [place] : [];
  });
}

function truckCandidatesFromOsm(osmPlaces, lat, lng) {
  if (!osmPlaces?.length) return [];
  return truckStopsFromOsm(osmPlaces, lat, lng, PLACES_ROUTE_MILES)
    .filter(p => (p.distanceMiles ?? 99) <= PLACES_ROUTE_MILES);
}

function allContextCandidatesFromSegment(segment, osmPlaces, lat, lng) {
  const out = [
    ...fuelCandidatesFromSegment(segment, {}),
    ...foodCandidatesFromSegment(segment),
    ...truckCandidatesFromOsm(osmPlaces, lat, lng),
  ];
  if (!segment) return out;
  for (const p of segment.playgrounds || []) {
    const c = compactPlaceToCandidate(p, "discovery");
    if (c && (c.distanceMiles ?? 99) <= PLACES_ROUTE_MILES) out.push(c);
  }
  return out;
}

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

function photoUrlFromPlace(place) {
  if (place.photoUrl) return place.photoUrl;
  const ref = place.photoReference;
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (ref && key) {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=480&photo_reference=${encodeURIComponent(ref)}&key=${key}`;
  }
  return null;
}

async function pickUniquePhoto(place, usedPhotoUrls, cachedDetails = null) {
  const fromNearby = photoUrlFromPlace(place);
  if (fromNearby && !usedPhotoUrls.has(fromNearby)) {
    usedPhotoUrls.add(fromNearby);
    return fromNearby;
  }

  const photoReference = cachedDetails?.photoReference || place.photoReference;
  if (photoReference) {
    const fromDetails = photoUrlFromPlace({ photoReference });
    if (fromDetails && !usedPhotoUrls.has(fromDetails)) {
      usedPhotoUrls.add(fromDetails);
      return fromDetails;
    }
  }

  return null;
}

async function enrichStopsForDisplay(stops) {
  const usedPhotoUrls = new Set();
  const enriched = [];

  for (const stop of stops) {
    const place = {
      placeId: stop.placeId,
      osmId: stop.id?.startsWith?.("osm-") ? stop.id : null,
      name: stop.name,
      address: stop.location,
      rating: stop.rating,
      lat: stop.lat,
      lng: stop.lng,
      distanceMiles: stop.distanceMiles,
      category: stop.category,
      source: stop.source,
      photoUrl: stop.photoUrl,
      photoReference: stop.photoReference,
    };

    const verified = await ensureNamedEnrichedPlace(place, stop.category);
    if (!verified) continue;

    const photoUrl = await pickUniquePhoto(
      { placeId: verified.placeId, photoUrl: verified.photoUrl, photoReference: verified.photoReference },
      usedPhotoUrls,
      verified,
    );

    enriched.push({
      ...stop,
      id: verified.placeId || stop.id,
      placeId: verified.placeId,
      name: verified.name,
      rating: verified.rating,
      note: verified.rating ? `${verified.rating} / 5` : "",
      photoUrl: photoUrl || verified.photoUrl || null,
      source: "google",
    });
  }

  return enriched;
}

function roadStopFromPlace(place, category, distanceLabel, photoUrl) {
  return {
    id: place.placeId || place.osmId || place.id,
    placeId: place.placeId || place.place_id || null,
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
    source: place.source || "places",
    userAdded: false,
  };
}

function roadStopFromOsm(osm, distanceLabel, distanceMiles) {
  const amenities = Array.isArray(osm.amenities) ? osm.amenities : [];
  return {
    id: osm.id,
    location: "Along route",
    distance: distanceLabel,
    eta: "—",
    category: osm.type || osm.category || "rest_area",
    name: osm.name || null,
    note: amenities.length ? amenities.join(", ") : "",
    lat: osm.lat,
    lng: osm.lon ?? osm.lng,
    photoUrl: null,
    rating: null,
    distanceMiles,
    amenities,
    source: "osm",
    userAdded: false,
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
  const osmLat = osm.lat;
  const osmLng = osm.lon ?? osm.lng;
  if (osmLat == null || osmLng == null) return false;
  return places.some(p => {
    if (p.lat == null || p.lng == null) return false;
    return haversineMiles(osmLat, osmLng, p.lat, p.lng) <= thresholdMiles;
  });
}

async function corridorNearbyAt(lat, lng, opts) {
  const { places } = await fetchPlacesNearbyCached({ lat, lng, ...opts });
  return places || [];
}

async function googleBrandGapFill(pt, osmPlaces) {
  const missing = missingTruckBrandsInSegment(osmPlaces, pt.lat, pt.lng, 5);
  if (!missing.length) return [];

  const merged = [];
  for (const brand of missing.slice(0, 2)) {
    const list = await corridorNearbyAt(pt.lat, pt.lng, {
      keyword: brand.googleKeyword,
      radius: 1609,
      maxResults: 4,
    });
    list.forEach((place) => {
      merged.push({ ...place, category: "truck_stop", brandId: brand.id, source: "google" });
    });
  }
  return merged;
}

async function searchHybridPlacesAtSample(pt, placesContext) {
  const osmPlaces = placesContext?.osmPlaces || [];
  const segment = findCorridorSegmentForPoint(placesContext, pt.lat, pt.lng);
  const fromContext = allContextCandidatesFromSegment(segment, osmPlaces, pt.lat, pt.lng);

  const merged = new Map();
  fromContext.forEach((place) => {
    const key = placeDedupKey(place) || place.osmId || `${place.name}:${place.lat}`;
    if (key) merged.set(key, place);
  });

  if (fromContext.length < 2) {
    const gapBrands = await googleBrandGapFill(pt, osmPlaces);
    gapBrands.forEach((place) => {
      const key = placeDedupKey(place);
      if (!key || merged.has(key)) return;
      merged.set(key, place);
    });
  }

  if (merged.size < 2 && fromContext.length === 0) {
    const list = await corridorNearbyAt(pt.lat, pt.lng, {
      keyword: "truck stop travel plaza gas station",
      radius: 1609,
      maxResults: 8,
    });
    list.forEach((place) => {
      const key = placeDedupKey(place);
      if (!key || merged.has(key)) return;
      merged.set(key, { ...place, category: "truck_stop" });
    });
  }

  return [...merged.values()];
}

async function searchAtSample(pt, sampleIndex, answers, fuelMode, continuousDrive, placesContext) {
  const osmPlaces = placesContext?.osmPlaces || [];
  const segment = findCorridorSegmentForPoint(placesContext, pt.lat, pt.lng);
  const searches = continuousDrive
    ? [...CONTINUOUS_DRIVE_SEARCHES]
    : [...GENERAL_SEARCHES];
  if (fuelMode !== "none" && !continuousDrive) {
    searches.unshift({ fuel: true, category: "fuel" });
  }
  const pick = searches[sampleIndex % searches.length];

  if (pick.fuel) {
    const fromContext = fuelCandidatesFromSegment(segment, answers);
    if (fromContext.length) return fromContext;

    const osmFuel = placesNearPoint(osmPlaces, pt.lat, pt.lng, PLACES_ROUTE_MILES, ["fuel", "truck_stop"])
      .map(p => osmPlaceToCandidate(p, "fuel", pt.lat, pt.lng));
    if (osmFuel.length) {
      const brand = getPreferredFuelBrand(answers);
      if (brand) {
        const named = osmFuel.filter(g => g.name && matchesPreferredFuelBrand(g.name, brand));
        if (named.length) return named;
      }
      return osmFuel;
    }

    const gasList = await corridorNearbyAt(pt.lat, pt.lng, {
      type: "gas_station",
      radius: 1609,
      maxResults: 8,
    });
    const brand = getPreferredFuelBrand(answers);
    const filtered = brand
      ? gasList.filter(g => matchesPreferredFuelBrand(g.name, brand))
      : gasList;
    return filtered.map(g => ({ ...g, category: "fuel" }));
  }

  if (pick.category === "food") {
    const fromContext = foodCandidatesFromSegment(segment);
    if (fromContext.length) return fromContext;

    const osmFood = placesNearPoint(osmPlaces, pt.lat, pt.lng, PLACES_ROUTE_MILES, ["restaurant"])
      .map(p => osmPlaceToCandidate(p, "food", pt.lat, pt.lng));
    if (osmFood.length) return osmFood;
  }

  const osmDiscoveryCats = DISCOVERY_OSM_CATEGORIES[pick.type];
  if (osmDiscoveryCats && hasOsmPoisNear(osmPlaces, pt.lat, pt.lng, PLACES_ROUTE_MILES, osmDiscoveryCats)) {
    const osmDiscovery = placesNearPoint(osmPlaces, pt.lat, pt.lng, PLACES_ROUTE_MILES, osmDiscoveryCats)
      .map(p => osmPlaceToCandidate(p, pick.category, pt.lat, pt.lng));
    if (osmDiscovery.length) return osmDiscovery;
  }

  const list = await corridorNearbyAt(pt.lat, pt.lng, {
    type: pick.type,
    keyword: pick.keyword,
    radius: 1609,
    maxResults: 8,
  });
  return list.map(p => ({ ...p, category: pick.category }));
}

async function buildHybridRoadStops(answers, routeInfo, options) {
  const { continuousDrive, totalMiles, maxStops, fuelMode, placesContext } = options;
  const routePoints = routeInfo.routePoints;
  const sampleInterval = continuousDrive ? CONTINUOUS_SAMPLE_INTERVAL_MI : SAMPLE_INTERVAL_MI;
  const samples = sampleRoutePointsEveryMiles(routePoints, sampleInterval);
  const placesCollected = [];
  const seenKeys = new Set();
  const stops = [];

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    if (!pt?.lat) continue;

    const hybridCandidates = await searchHybridPlacesAtSample(pt, placesContext);
    const fuelCandidates = await searchAtSample(pt, i, answers, fuelMode, continuousDrive, placesContext);
    const candidates = [...hybridCandidates, ...fuelCandidates];

    for (const place of candidates) {
      const key = placeDedupKey(place) || (place.osmId ? `osm:${place.osmId}` : null);
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
    stops.push(roadStopFromPlace(place, place.category || "fuel", mileLabel, null));
    if (place.distanceMiles == null) {
      stops[stops.length - 1].distanceMiles = distanceMiles;
    }
  }

  for (const osm of osmCollected) {
    const { fraction, distanceMiles } = closestRouteFraction(osm.lat, osm.lon, routePoints);
    const mileLabel = mileLabelForFraction(fraction, totalMiles);
    stops.push(roadStopFromOsm(osm, mileLabel, distanceMiles));
  }

  const finalStops = dedupePlaces(stops).slice(0, maxStops);
  return enrichStopsForDisplay(finalStops);
}

export async function buildRoadStopsFromRoute(answers, routeInfo, placesContext = null) {
  if (!routeInfo?.routePoints?.length) return [];

  const continuousDrive = answers?.continuous_drive === true
    || answers?.overnight_preference === "Drive straight through";
  const sampleInterval = continuousDrive ? CONTINUOUS_SAMPLE_INTERVAL_MI : SAMPLE_INTERVAL_MI;
  const maxStops = continuousDrive ? 16 : 12;
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  const fuelMode = getFuelStopMode(answers);

  if (useHybridRestEnrichment(answers, continuousDrive)) {
    return buildHybridRoadStops(answers, routeInfo, {
      continuousDrive,
      totalMiles,
      maxStops,
      fuelMode,
      placesContext,
    });
  }

  const samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, sampleInterval);
  const stops = [];
  const seenKeys = new Set();

  for (let i = 0; i < samples.length; i++) {
    const pt = samples[i];
    if (!pt?.lat) continue;

    const mileLabel = totalMiles
      ? `${Math.round((i / Math.max(1, samples.length - 1)) * totalMiles)} mi`
      : "—";

    const candidates = await searchAtSample(pt, i, answers, fuelMode, continuousDrive, placesContext);
    const place = candidates.find(p => {
      const key = placeDedupKey(p) || (p.osmId ? `osm:${p.osmId}` : null);
      if (!key || seenKeys.has(key)) return false;
      return (p.distanceMiles ?? 99) <= PLACES_ROUTE_MILES;
    });
    if (!place) continue;

    const key = placeDedupKey(place) || (place.osmId ? `osm:${place.osmId}` : null);
    if (key) seenKeys.add(key);
    stops.push(roadStopFromPlace(place, place.category || "discovery", mileLabel, null));
  }

  const finalStops = dedupePlaces(stops).slice(0, maxStops);
  return enrichStopsForDisplay(finalStops);
}
