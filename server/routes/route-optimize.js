/** Optimize multi-stop route order via Google Directions API (server-side). */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { geocodeAddress } from "../lib/geocode.js";

const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

async function resolveLocation(value) {
  if (!value) return null;
  if (typeof value === "object" && value.lat != null && value.lng != null) {
    return `${value.lat},${value.lng}`;
  }
  if (typeof value === "string") {
    const geo = await geocodeAddress(value);
    if (geo) return `${geo.lat},${geo.lng}`;
    return value;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const key = getGoogleMapsKey();
  if (!key) return res.status(503).json({ error: "Google Maps API key not configured" });

  const { origin, destination, stops = [] } = req.body || {};
  if (!origin || !destination) {
    return res.status(400).json({ error: "origin and destination are required" });
  }

  const waypointStops = stops.filter(s =>
    (s.lat != null && s.lng != null) || s.city,
  );
  if (waypointStops.length < 2) {
    return res.status(200).json({ stops, optimized: false });
  }

  try {
    const originLoc = await resolveLocation(origin);
    const destLoc = await resolveLocation(destination);
    if (!originLoc || !destLoc) {
      return res.status(400).json({ error: "Could not resolve origin or destination" });
    }

    const resolvedWaypoints = [];
    for (const stop of waypointStops) {
      if (stop.lat != null && stop.lng != null) {
        resolvedWaypoints.push({ stop, loc: `${stop.lat},${stop.lng}` });
      } else if (stop.city) {
        const geo = await geocodeAddress(stop.city);
        if (geo) {
          resolvedWaypoints.push({
            stop: { ...stop, lat: geo.lat, lng: geo.lng },
            loc: `${geo.lat},${geo.lng}`,
          });
        }
      }
    }

    if (resolvedWaypoints.length < 2) {
      return res.status(200).json({ stops, optimized: false });
    }

    const waypointParam = [
      "optimize:true",
      ...resolvedWaypoints.map(w => w.loc),
    ].join("|");

    const params = new URLSearchParams({
      key,
      origin: originLoc,
      destination: destLoc,
      waypoints: waypointParam,
      mode: "driving",
    });

    const response = await fetch(`${DIRECTIONS_URL}?${params}`);
    const data = await response.json();

    if (data.status !== "OK" || !data.routes?.[0]) {
      return res.status(200).json({ stops, optimized: false });
    }

    const order = data.routes[0].waypoint_order || [];
    const reordered = order.map(i => resolvedWaypoints[i]?.stop).filter(Boolean);
    const reorderedKeys = new Set(reordered.map(s => s.city || `${s.lat},${s.lng}`));
    const remaining = stops.filter(s => !reorderedKeys.has(s.city || `${s.lat},${s.lng}`));

    return res.status(200).json({
      stops: [...reordered, ...remaining],
      optimized: true,
      waypointOrder: order,
    });
  } catch (err) {
    console.error("route-optimize API error:", err);
    return res.status(500).json({ error: "Route optimization failed" });
  }
}
