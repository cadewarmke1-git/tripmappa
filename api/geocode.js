/** Geocode a city or address server-side. */
import { geocodeAddress } from "./lib/geocode.js";
import { getGoogleMapsKey } from "./lib/googleKey.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!getGoogleMapsKey()) {
    return res.status(503).json({ error: "Google Maps API key not configured" });
  }

  const { address } = req.body || {};
  if (!address) return res.status(400).json({ error: "address is required" });

  try {
    const result = await geocodeAddress(address);
    if (!result) return res.status(404).json({ error: "Address not found" });
    return res.status(200).json(result);
  } catch (err) {
    console.error("geocode API error:", err);
    return res.status(500).json({ error: "Geocoding failed" });
  }
}
