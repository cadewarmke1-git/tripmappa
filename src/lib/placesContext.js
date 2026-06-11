/** Pre-Sonnet corridor Places prefetch — anti-hallucination context for plan-trip. */
import { sampleRoutePointsEveryMiles, routePointAtFraction } from "./fuel.js";
import { searchGasStations, searchEvChargingStations } from "./placesStations.js";
import { searchRestaurants, searchLodging, searchNearbyCategory, RADIUS_2MI, RADIUS_10MI } from "./placesSearch.js";
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
import { runWithConcurrency } from "./asyncPool.js";

const CORRIDOR_RADIUS_M = 1609; // 1 mile
const SAMPLE_INTERVAL_MI = 30;
const MAX_CORRIDOR_SAMPLES = 30;
const LONG_ROUTE_MILES = 800;
const PLACES_FETCH_CONCURRENCY = 5;

function compactPlace(p) {
  return {
    name: p.name,
    address: p.address || "",
    rating: p.rating,
    userRatingsTotal: p.userRatingsTotal,
    distanceMi: p.distanceMiles,
    priceLevel: p.priceLevel,
    types: p.types || [],
    lat: p.lat,
    lng: p.lng,
  };
}

function isEvTrip(answers) {
  const ft = answers?.fuel_type || answers?.fuel || "";
  return /electric|ev|tesla/i.test(ft);
}

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
  let intervalMiles = SAMPLE_INTERVAL_MI;
  let samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, intervalMiles);

  if (totalMiles > LONG_ROUTE_MILES && samples.length > MAX_CORRIDOR_SAMPLES) {
    intervalMiles = Math.max(SAMPLE_INTERVAL_MI, totalMiles / MAX_CORRIDOR_SAMPLES);
    samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, intervalMiles);
  }

  if (totalMiles > LONG_ROUTE_MILES && samples.length > MAX_CORRIDOR_SAMPLES) {
    samples = subsampleEvenly(samples, MAX_CORRIDOR_SAMPLES);
  }

  return { samples, totalMiles, intervalMiles: intervalMiles };
}

function estimateOvernightCityCount(routeInfo, answers) {
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const nights = estimateOvernightStops(hours, answers?.trip_type, answers?.lodging);
  const corridorCities = routeInfo?.citiesAlongRoute?.length || 0;
  return Math.max(1, Math.min(5, nights || corridorCities || 2));
}

async function fetchMedicalAtPoint(lat, lng, answers) {
  const [pharmacies, dialysis, vet] = await Promise.all([
    needsRefrigeratedMedStops(answers)
      ? searchNearbyCategory(lat, lng, { type: "pharmacy", radius: RADIUS_10MI, maxResults: 3 })
      : Promise.resolve([]),
    needsDialysisServices(answers)
      ? searchNearbyCategory(lat, lng, { keyword: "dialysis center", radius: RADIUS_10MI, maxResults: 3 })
      : Promise.resolve([]),
    needsVetServices(answers)
      ? searchNearbyCategory(lat, lng, { type: "veterinary_care", radius: RADIUS_10MI, maxResults: 3 })
      : Promise.resolve([]),
  ]);

  const out = {};
  if (pharmacies.length) out.pharmacies = pharmacies.map(compactPlace);
  if (dialysis.length) out.dialysis = dialysis.map(compactPlace);
  if (vet.length) out.veterinary = vet.map(compactPlace);
  return out;
}

async function fetchCorridorSample(pt, answers, evTrip, teslaOnly) {
  const [gasRaw, evRaw, restaurantsRaw] = await Promise.all([
    searchGasStations(pt.lat, pt.lng, 8, CORRIDOR_RADIUS_M),
    evTrip
      ? searchEvChargingStations(pt.lat, pt.lng, 8, CORRIDOR_RADIUS_M)
      : Promise.resolve([]),
    searchRestaurants(pt.lat, pt.lng, answers),
  ]);

  let gas = applyStopFilters(gasRaw.map(g => ({ ...g, distanceMiles: g.distanceMiles })), answers);
  gas = gas.filter(g => (g.distanceMiles ?? 99) <= 1).slice(0, 3);

  let evStations = evRaw;
  if (teslaOnly) {
    evStations = evStations.filter(s => /tesla|supercharger/i.test(`${s.name || ""} ${s.address || ""}`));
  }
  evStations = evStations.filter(s => (s.distanceMiles ?? 99) <= 1).slice(0, 3);

  const allowChains = allowsNationalChains(answers);
  let restaurants = applyStopFilters(restaurantsRaw, answers)
    .filter(r => (r.distanceMiles ?? 99) <= 1);
  restaurants = filterFoodCandidates(restaurants);
  restaurants = filterRatingBand(restaurants);
  restaurants = filterGenericChains(restaurants, { allowChains });
  restaurants = restaurants.slice(0, 4);

  return {
    lat: pt.lat,
    lng: pt.lng,
    gasStations: gas.map(compactPlace),
    evStations: evStations.map(compactPlace),
    restaurants: restaurants.map(r => ({
      ...compactPlace(r),
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
}) {
  const frac = (index + 1) / (overnightCount + 1);
  const pt = routePointAtFraction(routeInfo.routePoints, frac);
  if (!pt?.lat) return null;

  const [lodgingRaw, medical] = await Promise.all([
    searchLodging(pt.lat, pt.lng, answers, routeInfo),
    fetchMedicalAtPoint(pt.lat, pt.lng, answers),
  ]);

  let lodging = lodgingRaw.filter(h => (h.distanceMiles ?? 99) <= 1);
  lodging = filterLodgingByTier(lodging, answers);
  lodging = filterRatingBand(lodging, { minRating: 4.0, minReviews: 30, maxReviews: 5000 });
  lodging = lodging.slice(0, 4);
  const cityName = routeInfo.citiesAlongRoute?.[Math.min(index, (routeInfo.citiesAlongRoute.length - 1))]
    || `Route mile ~${Math.round(frac * (boundary.totalMiles || 0))}`;

  const dietaryRestaurants = await fetchDietaryRestaurantsForCity(cityName, pt.lat, pt.lng, answers);

  return {
    city: cityName,
    lat: pt.lat,
    lng: pt.lng,
    hotels: lodging.map(compactPlace),
    dietaryRestaurants,
    medical,
  };
}

async function fetchDietaryRestaurantsForCity(cityName, lat, lng, answers) {
  const keywords = getDietarySearchKeywords(answers).filter(k => !/drive through/i.test(k));
  if (!keywords.length || lat == null) return [];

  const cityShort = String(cityName).split(",")[0]?.trim() || cityName;
  const allowChains = allowsNationalChains(answers);
  const merged = new Map();

  await Promise.all(keywords.slice(0, 4).map(async (baseKeyword) => {
    const keyword = `${baseKeyword} ${cityShort}`;
    const results = await searchNearbyCategory(lat, lng, {
      type: "restaurant",
      keyword,
      radius: RADIUS_10MI,
      maxResults: 5,
    });
    results.forEach((r) => {
      if (r.placeId) merged.set(r.placeId, r);
    });
  }));

  let out = applyStopFilters([...merged.values()], answers)
    .filter(r => (r.distanceMiles ?? 99) <= 10);
  out = filterFoodCandidates(out);
  out = filterRatingBand(out);
  out = filterGenericChains(out, { allowChains });
  return out.slice(0, 5).map(compactPlace);
}

export async function buildPlacesContext(answers, routeInfo) {
  if (!window.google?.maps?.places || !routeInfo?.routePoints?.length) {
    return { corridor: [], cities: [], boundary: { samples: [] } };
  }

  const boundary = buildRouteBoundary(routeInfo);
  const points = boundary.samples.filter(pt => pt.lat != null);
  const evTrip = isEvTrip(answers);
  const teslaOnly = isTeslaSuperchargerOnly(answers);

  const corridor = await runWithConcurrency(
    points,
    PLACES_FETCH_CONCURRENCY,
    (pt) => fetchCorridorSample(pt, answers, evTrip, teslaOnly),
  );

  const overnightCount = estimateOvernightCityCount(routeInfo, answers);
  const overnightIndexes = Array.from({ length: overnightCount }, (_, index) => index);
  const cities = (await runWithConcurrency(
    overnightIndexes,
    PLACES_FETCH_CONCURRENCY,
    (index) => fetchOvernightCity({
      routeInfo,
      boundary,
      answers,
      index,
      overnightCount,
    }),
  )).filter(Boolean);

  const interests = asArray(answers?.stops_interests);
  if (interests.some(i => /playground|park/i.test(i))) {
    const playgroundPoints = points.slice(0, Math.min(6, points.length));
    const playgroundResults = await runWithConcurrency(
      playgroundPoints,
      PLACES_FETCH_CONCURRENCY,
      (pt) => searchNearbyCategory(pt.lat, pt.lng, {
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
      (pt) => searchNearbyCategory(pt.lat, pt.lng, {
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

  return { corridor, cities, boundary, generatedAt: Date.now() };
}

export function formatRouteBoundaryForPrompt(routeInfo, boundary) {
  const b = boundary || buildRouteBoundary(routeInfo);
  if (!b.samples?.length) return "";
  const coordList = b.samples
    .map(p => `(${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`)
    .join("\n  ");
  return `
ROUTE GPS BOUNDARY (mandatory — never violate):
The user's actual Google Directions polyline has been sampled every ${SAMPLE_INTERVAL_MI} miles at these coordinates:
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
  lines.push("\nVERIFIED PLACES CONTEXT (use ONLY these real business names when suggesting stops in matching areas):");
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
