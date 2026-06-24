/** POST /api/places-details — cached Google Place Details keyed by place_id. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { fetchPlaceDetailsCached } from "../lib/placesDetailsCache.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { placeId } = req.body || {};
  const id = String(placeId || "").trim();
  if (!id) return res.status(400).json({ error: "placeId is required" });

  const { details, cached, apiError } = await fetchPlaceDetailsCached(key, id);

  if (apiError === "no_key") {
    return res.status(503).json({ error: "Google Maps API key not configured" });
  }
  if (apiError && !details) {
    return res.status(502).json({ error: "Place Details request failed", status: apiError });
  }
  if (!details) {
    return res.status(200).json({ details: null, cached: false, empty: true });
  }

  return res.status(200).json({ details, cached: cached === true });
}
