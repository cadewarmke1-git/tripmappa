/** OSM rest stop lookup helpers — Overpass query, bbox grid cache keys, normalization. */

const GRID_DEG = 0.15;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT_MS = 10_000;

export function roundBboxCoord(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n / GRID_DEG) * GRID_DEG;
}

export function normalizeBbox(bbox) {
  const north = roundBboxCoord(bbox?.north);
  const south = roundBboxCoord(bbox?.south);
  const east = roundBboxCoord(bbox?.east);
  const west = roundBboxCoord(bbox?.west);
  if ([north, south, east, west].some(v => v == null)) return null;
  if (north <= south || east <= west) return null;
  return { north, south, east, west };
}

export function bboxCacheKey(bbox, vehicleType = null) {
  const key = `${bbox.north}:${bbox.south}:${bbox.east}:${bbox.west}`;
  const vehicle = vehicleType ? String(vehicleType).trim().slice(0, 40) : "";
  return vehicle ? `${key}|${vehicle}` : key;
}

export function cacheExpiresBefore() {
  return new Date(Date.now() - CACHE_TTL_MS).toISOString();
}

function extractAmenities(tags = {}) {
  const amenities = [];
  if (tags.fuel === "yes" || tags.amenity === "fuel") amenities.push("fuel");
  if (tags.toilets === "yes") amenities.push("toilets");
  if (tags.shower === "yes" || tags.showers === "yes") amenities.push("shower");
  if (tags.hgv === "yes" || tags["parking:hgv"] === "yes" || tags.parking_hgv === "yes") {
    amenities.push("parking_hgv");
  }
  return amenities;
}

function inferStopType(tags = {}) {
  if (tags.amenity === "truck_stop") return "truck_stop";
  if (tags.highway === "services") return "services";
  if (tags.tourism === "caravan_site") return "services";
  if (tags.highway === "rest_area") return "rest_area";
  return "rest_area";
}

function normalizeOsmElement(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const type = inferStopType(tags);
  const name = typeof tags.name === "string" && tags.name.trim() ? tags.name.trim() : null;

  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    lat,
    lon,
    type,
    amenities: extractAmenities(tags),
    source: "osm",
  };
}

export function parseOverpassElements(elements = []) {
  const seen = new Set();
  const stops = [];
  for (const el of elements) {
    const stop = normalizeOsmElement(el);
    if (!stop) continue;
    const dedupeKey = `${stop.lat.toFixed(5)}:${stop.lon.toFixed(5)}:${stop.type}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    stops.push(stop);
  }
  return stops;
}

export function buildOverpassQuery(bbox) {
  const { south, west, north, east } = bbox;
  return `[out:json][timeout:10];
(
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

export async function fetchOverpassRestStops(bbox) {
  const query = buildOverpassQuery(bbox);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("Overpass rest-stops HTTP error:", res.status);
      return [];
    }
    const data = await res.json();
    return parseOverpassElements(data.elements || []);
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("Overpass rest-stops request timed out after 10s");
    } else {
      console.warn("Overpass rest-stops request failed:", err.message);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}
