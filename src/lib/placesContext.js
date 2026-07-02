/** Pre-Sonnet corridor Places prefetch — OSM-first anti-hallucination context for plan-trip. */
import { sampleRoutePointsEveryMiles, routePointAtFraction } from "./fuel.js";
import { searchNearbyCategory } from "./placesSearch.js";
import { fetchPlacesNearbyCached } from "./placesCorridorClient.js";
import { runWithConcurrency } from "./asyncPool.js";
import {
  applyStopFilters,
  allowsNationalChains,
  filterGenericChains,
  filterLodgingByTier,
  filterRatingBand,
  filterFoodCandidates,
} from "./placesFilters.js";
import { getDietarySearchKeywords } from "./dietaryKeywords.js";
import {
  asArray,
  isTeslaSuperchargerOnly,
  needsDialysisServices,
  needsRefrigeratedMedStops,
  needsVetServices,
} from "./tripAccommodations.js";
import { parseMilesFromDistance } from "./parsing.js";
import { estimateOvernightStops } from "./budget.js";
import { parseHoursFromDuration } from "./parsing.js";
import { resetPlacesBudget } from "./placesBudget.js";
import { getEffectiveVehicle, isWaterVehicle, skipLodgingQuestion } from "./vehicles.js";
import { OVERNIGHT_PREFERENCE_OVERNIGHT } from "./driveMode.js";
import {
  DENSE_SAMPLE_INTERVAL_MI,
  dietaryMatchOsmName,
  fetchOsmPlacesForRoute,
  fuelPlacesFromOsm,
  lodgingPlacesFromOsm,
  restaurantPlacesFromOsm,
} from "./osmCorridorPlaces.js";

const CORRIDOR_RADIUS_M = 1609; // 1 mile
const RADIUS_2MI = 3219;
const RADIUS_10MI = 16093;
const PLACES_FETCH_CONCURRENCY = 5;

function compactPlace(p) {
  return {
    placeId: p.placeId || p.place_id || null,
    osmId: p.osmId || null,
    name: p.name,
    address: p.address || "",
    rating: p.rating,
    userRatingsTotal: p.userRatingsTotal,
    distanceMi: p.distanceMiles ?? p.distanceMi,
    priceLevel: p.priceLevel,
    types: p.types || [],
    lat: p.lat,
    lng: p.lng,
    source: p.source || (p.placeId ? "google" : "osm"),
  };
}

/** Skip corridor context only for thin transport (plane/boat/ferry). OSM is free — include short day trips. */
export function shouldPrefetchPlacesContext(answers, routeInfo) {
  const vehicle = getEffectiveVehicle(answers);
  const tripType = answers?.trip_type;

  if (vehicle === "Plane" || isWaterVehicle(vehicle)) return false;
  if (tripType === "Flying" || tripType === "Ferry or Cruise") return false;

  return Boolean(routeInfo?.routePoints?.length);
}

function isEvTrip(answers) {
  const ft = answers?.fuel_type || answers?.fuel || "";
  return /electric|ev|tesla/i.test(ft);
}

const CORRIDOR_SAMPLE_INTERVAL_MI = 50;
const MAX_CORRIDOR_SAMPLES = 12;

/** Evenly thin a list of samples down to at most maxCount, always keeping the endpoints. */
function subsampleEvenly(samples, maxCount) {
  if (!samples?.length || samples.length <= maxCount) return samples || [];
  if (maxCount <= 1) return [samples[0]];
  const out = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i / (maxCount - 1)) * (samples.length - 1));
    out.push(samples[idx]);
  }
  return out;
}

export function buildRouteBoundary(routeInfo) {
  if (!routeInfo?.routePoints?.length) return { samples: [], totalMiles: 0 };
  const totalMiles = parseMilesFromDistance(routeInfo.distance);
  let intervalMiles = CORRIDOR_SAMPLE_INTERVAL_MI;
  let samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, intervalMiles);

  // Long routes: widen the spacing so the corridor stays at most MAX_CORRIDOR_SAMPLES points.
  if (samples.length > MAX_CORRIDOR_SAMPLES) {
    intervalMiles = Math.max(CORRIDOR_SAMPLE_INTERVAL_MI, totalMiles / MAX_CORRIDOR_SAMPLES);
    samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, intervalMiles);
  }
  // Fallback hard cap in case dense geometry still overshoots after widening.
  if (samples.length > MAX_CORRIDOR_SAMPLES) {
    samples = subsampleEvenly(samples, MAX_CORRIDOR_SAMPLES);
  }

  return { samples, totalMiles, intervalMiles };
}

function estimateOvernightCityCount(routeInfo, answers) {
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const nights = estimateOvernightStops(hours, answers?.trip_type, answers?.lodging);
  const corridorCities = routeInfo?.citiesAlongRoute?.length || 0;
  return Math.max(1, Math.min(5, nights || corridorCities || 2));
}

async function corridorNearby(lat, lng, { type, keyword, radius = CORRIDOR_RADIUS_M, maxResults = 8 } = {}) {
  const { places, error } = await fetchPlacesNearbyCached({
    lat,
    lng,
    type,
    keyword,
    radius,
    maxResults,
  });
  if (error) return [];
  return places;
}

async function fetchMedicalAtPoint(lat, lng, answers) {
  const [pharmacies, dialysis, vet] = await Promise.all([
    needsRefrigeratedMedStops(answers)
      ? corridorNearby(lat, lng, { type: "pharmacy", radius: RADIUS_10MI, maxResults: 3 })
      : Promise.resolve([]),
    needsDialysisServices(answers)
      ? corridorNearby(lat, lng, { keyword: "dialysis center", radius: RADIUS_10MI, maxResults: 3 })
      : Promise.resolve([]),
    needsVetServices(answers)
      ? corridorNearby(lat, lng, { type: "veterinary_care", radius: RADIUS_10MI, maxResults: 3 })
      : Promise.resolve([]),
  ]);

  const out = {};
  if (pharmacies.length) out.pharmacies = pharmacies.map(compactPlace);
  if (dialysis.length) out.dialysis = dialysis.map(compactPlace);
  if (vet.length) out.veterinary = vet.map(compactPlace);
  return out;
}

async function fetchCorridorSample(pt, answers, evTrip, teslaOnly, osmPlaces) {
  let gas = fuelPlacesFromOsm(osmPlaces, pt.lat, pt.lng, 1);
  if (!gas.length) {
    const gasRaw = await corridorNearby(pt.lat, pt.lng, { type: "gas_station", maxResults: 8 });
    gas = applyStopFilters(gasRaw.map(g => ({ ...g, distanceMiles: g.distanceMiles })), answers)
      .filter(g => (g.distanceMiles ?? 99) <= 1)
      .slice(0, 3)
      .map(compactPlace);
  }

  let evStations = [];
  // EV corridor context: NREL discovery at fuel-stop display time (no Google Places prefetch).

  const allowChains = allowsNationalChains(answers);
  let restaurants = restaurantPlacesFromOsm(osmPlaces, pt.lat, pt.lng, 1);
  if (!restaurants.length) {
    const restaurantsRaw = await corridorNearby(pt.lat, pt.lng, { type: "restaurant", keyword: "restaurant", maxResults: 8 });
    restaurants = applyStopFilters(restaurantsRaw, answers)
      .filter(r => (r.distanceMiles ?? 99) <= 1);
    restaurants = filterFoodCandidates(restaurants);
    restaurants = filterRatingBand(restaurants);
    restaurants = filterGenericChains(restaurants, { allowChains });
    restaurants = restaurants.slice(0, 4).map(compactPlace);
  } else {
    restaurants = filterGenericChains(restaurants, { allowChains }).slice(0, 4);
  }

  return {
    lat: pt.lat,
    lng: pt.lng,
    gasStations: gas,
    evStations,
    restaurants: restaurants.map(r => ({
      ...r,
      isDetour: r.isDetour || false,
    })),
  };
}

async function fetchOvernightCity({
  routeInfo,
  boundary,
  answers,
  index,
  overnightCount,
  osmPlaces,
}) {
  const frac = (index + 1) / (overnightCount + 1);
  const pt = routePointAtFraction(routeInfo.routePoints, frac);
  if (!pt?.lat) return null;

  const medical = await fetchMedicalAtPoint(pt.lat, pt.lng, answers);

  let hotels = lodgingPlacesFromOsm(osmPlaces, pt.lat, pt.lng, 5);
  if (!hotels.length) {
    const lodgingRaw = await searchNearbyCategory(pt.lat, pt.lng, {
      type: "lodging",
      keyword: "hotel",
      radius: 8047,
      maxResults: 12,
    });
    hotels = lodgingRaw
      .filter(h => (h.distanceMiles ?? 99) <= 5)
      .slice(0, 4)
      .map(compactPlace);
  } else {
    hotels = filterLodgingByTier(hotels, answers).slice(0, 4);
  }

  const cityName = routeInfo.citiesAlongRoute?.[Math.min(index, (routeInfo.citiesAlongRoute.length - 1))]
    || `Route mile ~${Math.round(frac * (boundary.totalMiles || 0))}`;

  const dietaryRestaurants = await fetchDietaryRestaurantsForCity(cityName, pt.lat, pt.lng, answers, osmPlaces);

  return {
    city: cityName,
    lat: pt.lat,
    lng: pt.lng,
    hotels,
    dietaryRestaurants,
    medical,
  };
}

async function fetchDietaryRestaurantsForCity(cityName, lat, lng, answers, osmPlaces) {
  const keywords = getDietarySearchKeywords(answers).filter(k => !/drive through/i.test(k));
  if (!keywords.length || lat == null) return [];

  const allowChains = allowsNationalChains(answers);
  let osmMatches = restaurantPlacesFromOsm(osmPlaces, lat, lng, 10)
    .filter(r => dietaryMatchOsmName(r.name, keywords));

  if (osmMatches.length >= 3) {
    osmMatches = filterGenericChains(osmMatches, { allowChains });
    return osmMatches.slice(0, 5);
  }

  const cityShort = String(cityName).split(",")[0]?.trim() || cityName;
  const merged = new Map(osmMatches.map(r => [r.osmId || r.name, r]));

  await Promise.all(keywords.slice(0, 4).map(async (baseKeyword) => {
    const keyword = `${baseKeyword} ${cityShort}`;
    const results = await corridorNearby(lat, lng, {
      type: "restaurant",
      keyword,
      radius: RADIUS_10MI,
      maxResults: 5,
    });
    results.forEach((r) => {
      if (r.placeId) merged.set(r.placeId, compactPlace(r));
    });
  }));

  let out = applyStopFilters([...merged.values()], answers)
    .filter(r => (r.distanceMi ?? r.distanceMiles ?? 99) <= 10);
  out = filterFoodCandidates(out);
  out = filterRatingBand(out);
  out = filterGenericChains(out, { allowChains });
  return out.slice(0, 5);
}

export async function buildPlacesContext(answers, routeInfo) {
  if (!routeInfo?.routePoints?.length) {
    return { corridor: [], cities: [], boundary: { samples: [] } };
  }
  if (!shouldPrefetchPlacesContext(answers, routeInfo)) {
    return { corridor: [], cities: [], boundary: { samples: [] }, skipped: true };
  }

  resetPlacesBudget();

  const boundary = buildRouteBoundary(routeInfo);
  const points = boundary.samples.filter(pt => pt.lat != null);
  const evTrip = isEvTrip(answers);
  const teslaOnly = isTeslaSuperchargerOnly(answers);

  const osmPlaces = await fetchOsmPlacesForRoute(
    routeInfo.routePoints,
    boundary.totalMiles,
    DENSE_SAMPLE_INTERVAL_MI,
  );

  const corridor = await runWithConcurrency(
    points,
    PLACES_FETCH_CONCURRENCY,
    (pt) => fetchCorridorSample(pt, answers, evTrip, teslaOnly, osmPlaces),
  );

  const overnightCount = estimateOvernightCityCount(routeInfo, answers);
  const needsOvernight = !skipLodgingQuestion(answers?.trip_type, getEffectiveVehicle(answers))
    && answers?.overnight_preference === OVERNIGHT_PREFERENCE_OVERNIGHT;
  const overnightIndexes = needsOvernight
    ? Array.from({ length: overnightCount }, (_, index) => index)
    : [];

  const cities = (await runWithConcurrency(
    overnightIndexes,
    PLACES_FETCH_CONCURRENCY,
    (index) => fetchOvernightCity({
      routeInfo,
      boundary,
      answers,
      index,
      overnightCount,
      osmPlaces,
    }),
  )).filter(Boolean);

  const interests = asArray(answers?.stops_interests);
  if (interests.some(i => /playground|park/i.test(i))) {
    const playgroundPoints = points.slice(0, Math.min(6, points.length));
    const playgroundResults = await runWithConcurrency(
      playgroundPoints,
      PLACES_FETCH_CONCURRENCY,
      (pt) => corridorNearby(pt.lat, pt.lng, {
        keyword: "playground park",
        radius: RADIUS_2MI,
        maxResults: 3,
      }).then(parks => ({
        lat: pt.lat,
        lng: pt.lng,
        playgrounds: parks.filter(p => (p.distanceMiles ?? 99) <= 2).map(compactPlace),
      })),
    );
    for (const result of playgroundResults) {
      const last = corridor.find(c => c.lat === result.lat && c.lng === result.lng);
      if (last && result.playgrounds.length) last.playgrounds = result.playgrounds;
    }
  }

  if (interests.some(i => /prayer/i.test(i))) {
    const prayerPoints = points.slice(0, Math.min(4, points.length));
    const prayerResults = await runWithConcurrency(
      prayerPoints,
      PLACES_FETCH_CONCURRENCY,
      (pt) => corridorNearby(pt.lat, pt.lng, {
        keyword: "mosque church temple synagogue",
        radius: RADIUS_2MI,
        maxResults: 2,
      }).then(prayer => ({
        lat: pt.lat,
        lng: pt.lng,
        prayerFacilities: prayer.map(compactPlace),
      })),
    );
    for (const result of prayerResults) {
      const last = corridor.find(c => c.lat === result.lat && c.lng === result.lng);
      if (last && result.prayerFacilities.length) last.prayerFacilities = result.prayerFacilities;
    }
  }

  return {
    corridor,
    cities,
    boundary,
    osmPlaces,
    generatedAt: Date.now(),
  };
}

export function formatRouteBoundaryForPrompt(routeInfo, boundary) {
  const b = boundary || buildRouteBoundary(routeInfo);
  if (!b.samples?.length) return "";
  const coordList = b.samples
    .map(p => `(${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`)
    .join("\n  ");
  return `
ROUTE GPS BOUNDARY (mandatory — never violate):
The user's actual Google Directions polyline has been sampled every ${boundary?.intervalMiles ?? DENSE_SAMPLE_INTERVAL_MI} miles at these coordinates:
  ${coordList}

CRITICAL RULES:
- ONLY suggest stops, cities, restaurants, fuel, and lodging within 1 mile of this coordinate corridor.
- NEVER suggest a location outside this boundary.
- NEVER place stops using only origin/destination city names — use these GPS coordinates.
- Every road_stop and overnight stop city MUST lie on this corridor.`;
}

export function formatPlacesContextForPrompt(ctx) {
  const lines = [];
  if (ctx?.boundary?.samples?.length) {
    lines.push(formatRouteBoundaryForPrompt(null, ctx.boundary));
  }
  if (!ctx?.corridor?.length && !ctx?.cities?.length) {
    lines.push("\n- placesContext: none available — use corridor GPS boundary only; keep names generic if unsure");
    return lines.join("\n");
  }
  lines.push("\nVERIFIED PLACES CONTEXT (OSM + Google — corridor samples span the FULL route from origin to destination):");
  ctx.corridor?.forEach((seg, i) => {
    lines.push(`Corridor sample ${i + 1} @ ${seg.lat?.toFixed(4)}, ${seg.lng?.toFixed(4)}:`);
    if (seg.gasStations?.length) lines.push(`  Gas: ${seg.gasStations.map(g => `${g.name}${g.rating ? ` (${g.rating}★)` : ""}`).join(", ")}`);
    if (seg.evStations?.length) lines.push(`  EV charging: ${seg.evStations.map(e => e.name).join(", ")}`);
    if (seg.restaurants?.length) lines.push(`  Restaurants: ${seg.restaurants.map(r => `${r.name}${r.rating ? ` (${r.rating}★)` : ""}`).join(", ")}`);
    if (seg.playgrounds?.length) lines.push(`  Parks/playgrounds: ${seg.playgrounds.map(p => p.name).join(", ")}`);
    if (seg.prayerFacilities?.length) lines.push(`  Prayer facilities: ${seg.prayerFacilities.map(p => p.name).join(", ")}`);
  });
  ctx.cities?.forEach(c => {
    if (c.hotels?.length) lines.push(`${c.city} hotels (on-route GPS): ${c.hotels.map(h => `${h.name}${h.rating ? ` (${h.rating}★)` : ""}`).join(", ")}`);
    if (c.dietaryRestaurants?.length) {
      lines.push(`${c.city} dietary-match restaurants (VERIFIED PLACES): ${c.dietaryRestaurants.map(r => `${r.name}${r.rating ? ` (${r.rating}★)` : ""}`).join(", ")}`);
    }
    if (c.medical?.pharmacies?.length) lines.push(`${c.city} pharmacies: ${c.medical.pharmacies.map(p => p.name).join(", ")}`);
    if (c.medical?.dialysis?.length) lines.push(`${c.city} dialysis: ${c.medical.dialysis.map(d => d.name).join(", ")}`);
    if (c.medical?.veterinary?.length) lines.push(`${c.city} vet care: ${c.medical.veterinary.map(v => v.name).join(", ")}`);
  });
  lines.push("- Do NOT invent business names when a verified name exists above for that corridor segment.");
  lines.push("- Mark each road_stop you derive from this list with \"fromLlm\": true only when you add narrative beyond these names; prefer copying verified names exactly.");
  return lines.join("\n");
}
