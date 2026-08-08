/** POST /api/places-resolve — targeted name resolution at GPS (Nearby corridor cache + Details). */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { resolvePlaceAtLocation } from "../lib/placesResolveAtLocation.js";

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
    osmId = null,
    placeId = null,
    skipPhotos = false,
  } = req.body || {};
  const latNum = Number(lat);
  const lngNum = Number(lng);
  // placeId-only resolve is allowed (Details without Nearby); otherwise need coords.
  if (!placeId && (!Number.isFinite(latNum) || !Number.isFinite(lngNum))) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }

  const admin = getSupabaseAdmin();
  const {
    details,
    cached,
    nearbyUsed,
    nearbyCallsBilled = 0,
    osmMapHit = false,
    detailsSkipped = false,
  } = await resolvePlaceAtLocation(key, latNum, lngNum, {
    type: type || null,
    keyword: keyword || null,
    osmId: osmId || null,
    placeId: placeId || null,
    skipPhotos: skipPhotos === true,
    admin,
  });

  if (!details) {
    return res.status(200).json({
      details: null,
      cached: false,
      empty: true,
      nearbyUsed,
      nearbyCallsBilled,
      osmMapHit,
      detailsSkipped,
    });
  }

  return res.status(200).json({
    details,
    cached: cached === true,
    nearbyUsed: nearbyUsed === true,
    nearbyCallsBilled,
    osmMapHit: osmMapHit === true,
    detailsSkipped: detailsSkipped === true,
  });
}
