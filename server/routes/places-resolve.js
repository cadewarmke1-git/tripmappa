/** POST /api/places-resolve — targeted name resolution at GPS (Nearby + Details cache). */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { resolvePlaceAtLocation } from "../lib/placesResolveAtLocation.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { lat, lng, type = null, keyword = null } = req.body || {};
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }

  const { details, cached, nearbyUsed } = await resolvePlaceAtLocation(key, latNum, lngNum, {
    type: type || null,
    keyword: keyword || null,
  });

  if (!details) {
    return res.status(200).json({ details: null, cached: false, empty: true, nearbyUsed });
  }

  return res.status(200).json({
    details,
    cached: cached === true,
    nearbyUsed: nearbyUsed === true,
  });
}
