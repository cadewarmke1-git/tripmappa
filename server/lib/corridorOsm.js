/** OSM corridor POI lookup — fuel, restaurants, lodging, truck stops (Overpass + cache keys). */

import {
  bboxCacheKey,
  cacheExpiresBefore,
  normalizeBbox,
  parseOverpassElements,
} from "./restStopOsm.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 12_000;

export const TRUCK_BRAND_PATTERNS = [
  { id: "loves", pattern: /love'?s/i, googleKeyword: "Love's Travel Stop" },
  { id: "pilot", pattern: /pilot|flying j/i, googleKeyword: "Pilot Flying J" },
  { id: "ta", pattern: /\bta\b|travelcenters of america/i, googleKeyword: "TA Truck Stop" },
  { id: "petro", pattern: /petro/i, googleKeyword: "Petro truck stop" },
];

export function corridorBboxCacheKey(bbox) {
  return `corridor:v1:${bboxCacheKey(bbox)}`;
}

export { normalizeBbox, cacheExpiresBefore };

function inferFoodCategory(tags = {}) {
  if (tags.amenity === "fast_food") return "restaurant";
  if (tags.amenity === "cafe") return "restaurant";
  if (tags.amenity === "restaurant") return "restaurant";
  return null;
}

function inferLodgingCategory(tags = {}) {
  if (tags.tourism === "hotel" || tags.tourism === "motel" || tags.tourism === "guest_house") return "lodging";
  if (tags.amenity === "hotel") return "lodging";
  return null;
}

function inferFuelCategory(tags = {}) {
  if (tags.amenity === "fuel" || tags.amenity === "gas_station") return "fuel";
  if (tags.shop === "gas" || tags.shop === "fuel") return "fuel";
  return null;
}

export function matchTruckBrand(name, operator = "") {
  const label = `${name || ""} ${operator || ""}`;
  return TRUCK_BRAND_PATTERNS.find(b => b.pattern.test(label)) || null;
}

function normalizeCorridorElement(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const name = typeof tags.name === "string" && tags.name.trim() ? tags.name.trim() : null;
  const operator = typeof tags.operator === "string" ? tags.operator.trim() : "";

  let category = null;
  if (tags.amenity === "truck_stop") category = "truck_stop";
  else if (tags.highway === "services") category = "services";
  else if (tags.highway === "rest_area") category = "rest_area";
  else category = inferFuelCategory(tags)
    || inferFoodCategory(tags)
    || inferLodgingCategory(tags);

  if (!category) return null;

  const brand = matchTruckBrand(name, operator);

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    operator: operator || null,
    lat,
    lon,
    category,
    brandId: brand?.id || null,
    amenities: [],
    source: "osm",
  };
}

export function parseCorridorElements(elements = []) {
  const restStops = parseOverpassElements(elements);
  const seen = new Set(restStops.map(s => `${s.lat?.toFixed(5)}:${s.lon?.toFixed(5)}`));
  const places = restStops.map(s => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    category: s.type === "truck_stop" ? "truck_stop" : s.type,
    brandId: matchTruckBrand(s.name)?.id || null,
    source: "osm",
  }));

  for (const el of elements) {
    const place = normalizeCorridorElement(el);
    if (!place) continue;
    const key = `${place.lat.toFixed(5)}:${place.lon.toFixed(5)}:${place.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(place);
  }
  return places;
}

export function buildCorridorOverpassQuery(bbox) {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:12];
(
  node["amenity"="fuel"](${south},${west},${north},${east});
  way["amenity"="fuel"](${south},${west},${north},${east});
  node["amenity"="gas_station"](${south},${west},${north},${east});
  way["amenity"="gas_station"](${south},${west},${north},${east});
  node["amenity"="restaurant"](${south},${west},${north},${east});
  way["amenity"="restaurant"](${south},${west},${north},${east});
  node["amenity"="fast_food"](${south},${west},${north},${east});
  way["amenity"="fast_food"](${south},${west},${north},${east});
  node["amenity"="cafe"](${south},${west},${north},${east});
  way["amenity"="cafe"](${south},${west},${north},${east});
  node["tourism"="hotel"](${south},${west},${north},${east});
  way["tourism"="hotel"](${south},${west},${north},${east});
  node["tourism"="motel"](${south},${west},${north},${east});
  way["tourism"="motel"](${south},${west},${north},${east});
  node["highway"="rest_area"](${south},${west},${north},${east});
  way["highway"="rest_area"](${south},${west},${north},${east});
  node["amenity"="truck_stop"](${south},${west},${north},${east});
  way["amenity"="truck_stop"](${south},${west},${north},${east});
  node["highway"="services"](${south},${west},${north},${east});
  way["highway"="services"](${south},${west},${north},${east});
  node["tourism"="caravan_site"](${south},${west},${north},${east});
  way["tourism"="caravan_site"](${south},${west},${north},${east});
);
out center;`;
}

export async function fetchOverpassCorridorPlaces(bbox) {
  const query = buildCorridorOverpassQuery(bbox);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "TripMappa/1.0",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("Overpass corridor HTTP error:", res.status);
      return [];
    }
    const data = await res.json();
    return parseCorridorElements(data.elements || []);
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("Overpass corridor request timed out");
    } else {
      console.warn("Overpass corridor request failed:", err.message);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
