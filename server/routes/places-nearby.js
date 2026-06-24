/** POST /api/places-nearby — cached Google Places Nearby Search for corridor prefetch. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { attachDistanceMiles, corridorCacheKey, nearbySearchCached } from "../lib/placesCorridor.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const {
    lat,
    lng,
    type = null,
    keyword = null,
    radius = 1609,
    maxResults = 8,
  } = req.body || {};

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }

  const searchRow = {
    lat: latNum,
    lng: lngNum,
    type: type || "",
    keyword: keyword || "",
    radius: Math.round(Number(radius) || 1609),
  };
  const cacheKey = corridorCacheKey(searchRow);
  if (!cacheKey) return res.status(400).json({ error: "Invalid search coordinates" });

  const admin = getSupabaseAdmin();
  const { places, cached, apiError } = await nearbySearchCached(admin, key, {
    ...searchRow,
    maxResults,
  });

  if (apiError === "no_key") {
    return res.status(503).json({ error: "Google Maps API key not configured" });
  }
  if (apiError) {
    return res.status(502).json({ error: "Places API request failed", status: apiError });
  }

  const withDistance = attachDistanceMiles(places, latNum, lngNum);
  return res.status(200).json({
    places: withDistance.slice(0, maxResults),
    cached: cached === true,
  });
}
