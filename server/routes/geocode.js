/** Geocode a city or address server-side. */
import { geocodeAddress } from "../lib/geocode.js";
import { captureServerException } from "../lib/sentry.js";
import { reverseGeocodeCached } from "../lib/geocodeCache.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { clampString, guardProxyRoute } from "../lib/apiSecurity.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  if (!getGoogleMapsKey()) {
    return res.status(503).json({ error: "Google Maps API key not configured" });
  }

  const { address: rawAddress, lat, lng } = req.body || {};
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
    try {
      const result = await reverseGeocodeCached(latNum, lngNum);
      if (!result) return res.status(404).json({ error: "Location not found" });
      return res.status(200).json(result);
    } catch (err) {
      console.error("reverse geocode API error:", err);
    captureServerException(err);
      return res.status(500).json({ error: "Reverse geocoding failed" });
    }
  }

  const address = clampString(rawAddress, 200);
  if (!address.trim()) return res.status(400).json({ error: "address or lat/lng is required" });

  try {
    const result = await geocodeAddress(address.trim());
    if (!result) return res.status(404).json({ error: "Address not found" });
    return res.status(200).json(result);
  } catch (err) {
    console.error("geocode API error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Geocoding failed" });
  }
}
