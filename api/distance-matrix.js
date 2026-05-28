import { getGoogleMapsKey } from "./lib/googleKey.js";

/** POST /api/distance-matrix — ETA from coordinates to one or more destinations. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = getGoogleMapsKey();
  if (!key) {
    return res.status(503).json({ error: "Maps API not configured" });
  }

  const { latitude, longitude, destinations = [] } = req.body || {};
  if (latitude == null || longitude == null || !destinations.length) {
    return res.status(400).json({ error: "Missing latitude, longitude, or destinations" });
  }

  const origins = `${latitude},${longitude}`;
  const destParam = destinations.map(d => (typeof d === "string" ? d : `${d.lat},${d.lng}`)).join("|");

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", origins);
    url.searchParams.set("destinations", destParam);
    url.searchParams.set("key", key);
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("traffic_model", "best_guess");

    const apiRes = await fetch(url);
    const data = await apiRes.json();

    if (data.status !== "OK") {
      return res.status(502).json({ error: data.error_message || "Distance Matrix error" });
    }

    const elements = data.rows?.[0]?.elements || [];
    const results = destinations.map((dest, i) => {
      const el = elements[i];
      if (!el || el.status !== "OK") {
        return { destination: dest, ok: false };
      }
      return {
        destination: dest,
        ok: true,
        durationText: el.duration_in_traffic?.text || el.duration?.text,
        durationSeconds: el.duration_in_traffic?.value || el.duration?.value,
        distanceText: el.distance?.text,
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error("distance-matrix error:", err);
    return res.status(500).json({ error: "Could not calculate ETA" });
  }
}
