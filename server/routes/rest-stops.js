/** POST /api/rest-stops — OSM highway rest areas with Supabase bbox cache. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  bboxCacheKey,
  cacheExpiresBefore,
  fetchOverpassRestStops,
  normalizeBbox,
} from "../lib/restStopOsm.js";

async function readCachedStops(admin, cacheKey) {
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("rest_stop_cache")
      .select("stops, cached_at")
      .eq("bbox_key", cacheKey)
      .gte("cached_at", cacheExpiresBefore())
      .maybeSingle();
    if (error) {
      console.warn("rest_stop_cache read:", error.message);
      return null;
    }
    if (!data?.stops) return null;
    return Array.isArray(data.stops) ? data.stops : [];
  } catch (err) {
    console.warn("rest_stop_cache read failed:", err.message);
    return null;
  }
}

async function writeCachedStops(admin, cacheKey, bbox, vehicleType, stops) {
  if (!admin) return;
  try {
    const { error } = await admin
      .from("rest_stop_cache")
      .upsert({
        bbox_key: cacheKey,
        north: bbox.north,
        south: bbox.south,
        east: bbox.east,
        west: bbox.west,
        vehicle_type: vehicleType || null,
        stops,
        cached_at: new Date().toISOString(),
      }, { onConflict: "bbox_key" });
    if (error) console.warn("rest_stop_cache write:", error.message);
  } catch (err) {
    console.warn("rest_stop_cache write failed:", err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const { bbox, vehicleType = null } = req.body || {};
  const normalized = normalizeBbox(bbox);
  if (!normalized) {
    return res.status(400).json({ error: "bbox requires numeric north, south, east, west" });
  }

  const cacheKey = bboxCacheKey(normalized, vehicleType);
  const admin = getSupabaseAdmin();

  const cached = await readCachedStops(admin, cacheKey);
  if (cached) {
    return res.status(200).json({ stops: cached, cached: true });
  }

  const stops = await fetchOverpassRestStops(normalized);
  await writeCachedStops(admin, cacheKey, normalized, vehicleType, stops);

  return res.status(200).json({ stops, cached: false });
}
