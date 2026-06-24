/** Shared OSM corridor helpers — dense sampling, proximity filter, brand matching. */
import { fetchCorridorOsmForBbox } from "./corridorOsmClient.js";
import { runWithConcurrency } from "./asyncPool.js";

export const DENSE_SAMPLE_INTERVAL_MI = 30;
export const OSM_FETCH_CONCURRENCY = 4;

export const TRUCK_BRAND_PATTERNS = [
  { id: "loves", pattern: /love'?s/i, googleKeyword: "Love's Travel Stop" },
  { id: "pilot", pattern: /pilot|flying j/i, googleKeyword: "Pilot Flying J" },
  { id: "ta", pattern: /\bta\b|travelcenters of america/i, googleKeyword: "TA Truck Stop" },
  { id: "petro", pattern: /petro/i, googleKeyword: "Petro truck stop" },
];

const FUEL_CATEGORIES = new Set(["fuel", "truck_stop", "services", "rest_area"]);
const FOOD_CATEGORIES = new Set(["restaurant"]);
const LODGING_CATEGORIES = new Set(["lodging"]);

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function matchTruckBrand(name, operator = "") {
  const label = `${name || ""} ${operator || ""}`;
  return TRUCK_BRAND_PATTERNS.find(b => b.pattern.test(label)) || null;
}

export function compactOsmPlace(p, originLat, originLng) {
  const lat = p.lat;
  const lng = p.lon ?? p.lng;
  const dist = (originLat != null && lng != null)
    ? Math.round(haversineMiles(originLat, originLng, lat, lng) * 10) / 10
    : null;
  return {
    placeId: null,
    osmId: p.id,
    name: p.name,
    address: "",
    rating: null,
    userRatingsTotal: null,
    distanceMi: dist,
    priceLevel: null,
    types: [p.category],
    lat,
    lng,
    source: "osm",
    category: p.category,
    brandId: p.brandId || matchTruckBrand(p.name, p.operator)?.id || null,
  };
}

export function osmPlaceToCandidate(p, category, originLat, originLng) {
  const compact = compactOsmPlace(p, originLat, originLng);
  return {
    placeId: null,
    osmId: compact.osmId,
    name: compact.name,
    address: "",
    rating: null,
    lat: compact.lat,
    lng: compact.lng,
    distanceMiles: compact.distanceMi,
    category: category || p.category,
    source: "osm",
    brandId: compact.brandId,
  };
}

export function placesNearPoint(allPlaces, lat, lng, radiusMi, categories = null) {
  if (!allPlaces?.length || lat == null || lng == null) return [];
  const catSet = categories ? new Set(categories) : null;
  return allPlaces.filter((p) => {
    const plat = p.lat;
    const plng = p.lon ?? p.lng;
    if (plat == null || plng == null) return false;
    if (catSet && !catSet.has(p.category)) return false;
    return haversineMiles(lat, lng, plat, plng) <= radiusMi;
  });
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

export function buildDenseSegmentBboxes(routePoints, totalMiles, intervalMiles = DENSE_SAMPLE_INTERVAL_MI) {
  if (!routePoints?.length) return [];
  const miles = totalMiles || routePoints.length;
  const segmentCount = Math.max(1, Math.ceil(miles / intervalMiles));
  const segments = [];

  for (let i = 0; i < segmentCount; i++) {
    const startFrac = i / segmentCount;
    const endFrac = (i + 1) / segmentCount;
    const startIdx = Math.floor(startFrac * (routePoints.length - 1));
    const endIdx = Math.min(routePoints.length - 1, Math.ceil(endFrac * (routePoints.length - 1)));
    const slice = routePoints.slice(startIdx, endIdx + 1);
    const bbox = bboxForPoints(slice);
    if (!bbox) continue;
    segments.push({ startFrac, endFrac, bbox, points: slice });
  }
  return segments;
}

function dedupeOsmPlaces(places) {
  const seen = new Set();
  const out = [];
  for (const p of places) {
    const key = p.id || `${p.lat?.toFixed(5)}:${(p.lon ?? p.lng)?.toFixed(5)}:${p.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export async function fetchOsmPlacesForRoute(routePoints, totalMiles, intervalMiles = DENSE_SAMPLE_INTERVAL_MI) {
  const segments = buildDenseSegmentBboxes(routePoints, totalMiles, intervalMiles);
  if (!segments.length) return [];

  const results = await runWithConcurrency(
    segments,
    OSM_FETCH_CONCURRENCY,
    async (seg) => {
      const { places, error } = await fetchCorridorOsmForBbox({ bbox: seg.bbox });
      if (error) return [];
      return places || [];
    },
  );

  return dedupeOsmPlaces(results.flat());
}

export function fuelPlacesFromOsm(osmPlaces, lat, lng, radiusMi = 1) {
  return placesNearPoint(osmPlaces, lat, lng, radiusMi, [...FUEL_CATEGORIES])
    .map(p => compactOsmPlace(p, lat, lng))
    .slice(0, 4);
}

export function restaurantPlacesFromOsm(osmPlaces, lat, lng, radiusMi = 1) {
  return placesNearPoint(osmPlaces, lat, lng, radiusMi, [...FOOD_CATEGORIES])
    .map(p => compactOsmPlace(p, lat, lng))
    .slice(0, 5);
}

export function lodgingPlacesFromOsm(osmPlaces, lat, lng, radiusMi = 5) {
  return placesNearPoint(osmPlaces, lat, lng, radiusMi, [...LODGING_CATEGORIES])
    .map(p => compactOsmPlace(p, lat, lng))
    .slice(0, 6);
}

/** True when OSM has any POI of given categories nearby (named or unnamed). */
export function hasOsmPoisNear(osmPlaces, lat, lng, radiusMi, categories) {
  return placesNearPoint(osmPlaces, lat, lng, radiusMi, categories).length > 0;
}

export function truckStopsFromOsm(osmPlaces, lat, lng, radiusMi = 1) {
  return placesNearPoint(osmPlaces, lat, lng, radiusMi, ["truck_stop", "services"])
    .map(p => osmPlaceToCandidate(p, "truck_stop", lat, lng))
    .filter(Boolean);
}

export function missingTruckBrandsInSegment(osmPlaces, lat, lng, radiusMi = 5) {
  const near = placesNearPoint(osmPlaces, lat, lng, radiusMi, ["truck_stop", "services", "fuel"]);
  const found = new Set();
  for (const p of near) {
    const brand = p.brandId || matchTruckBrand(p.name, p.operator)?.id;
    if (brand) found.add(brand);
  }
  return TRUCK_BRAND_PATTERNS.filter(b => !found.has(b.id));
}

export function dietaryMatchOsmName(name, keywords) {
  if (!name || !keywords?.length) return true;
  const lower = name.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase().split(" ")[0]));
}
