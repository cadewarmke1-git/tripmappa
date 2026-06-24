/** POST /api/corridor-osm — OSM corridor POI lookup with Supabase bbox cache. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  cacheExpiresBefore,
  corridorBboxCacheKey,
  fetchOverpassCorridorPlaces,
  normalizeBbox,
} from "../lib/corridorOsm.js";

async function readCachedPlaces(admin, cacheKey) {
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("osm_corridor_cache")
      .select("places, cached_at")
      .eq("bbox_key", cacheKey)
      .gte("cached_at", cacheExpiresBefore())
      .maybeSingle();
    if (error) {
      console.warn("osm_corridor_cache read:", error.message);
      return null;
    }
    if (!data?.places) return null;
    return Array.isArray(data.places) ? data.places : [];
  } catch (err) {
    console.warn("osm_corridor_cache read failed:", err.message);
    return null;
  }
}

async function writeCachedPlaces(admin, cacheKey, bbox, places) {
  if (!admin) return;
  try {
    const { error } = await admin
      .from("osm_corridor_cache")
      .upsert({
        bbox_key: cacheKey,
        north: bbox.north,
        south: bbox.south,
        east: bbox.east,
        west: bbox.west,
        places,
        cached_at: new Date().toISOString(),
      }, { onConflict: "bbox_key" });
    if (error) console.warn("osm_corridor_cache write:", error.message);
  } catch (err) {
    console.warn("osm_corridor_cache write failed:", err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const { bbox } = req.body || {};
  const normalized = normalizeBbox(bbox);
  if (!normalized) {
    return res.status(400).json({ error: "bbox requires numeric north, south, east, west" });
  }

  const cacheKey = corridorBboxCacheKey(normalized);
  const admin = getSupabaseAdmin();

  const cached = await readCachedPlaces(admin, cacheKey);
  if (cached) {
    return res.status(200).json({ places: cached, cached: true });
  }

  const places = await fetchOverpassCorridorPlaces(normalized);
  await writeCachedPlaces(admin, cacheKey, normalized, places);

  return res.status(200).json({ places, cached: false });
}
