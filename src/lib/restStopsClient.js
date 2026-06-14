import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Client fetch for /api/rest-stops (OSM highway facilities). */
export async function fetchRestStopsForBbox({ bbox, vehicleType = null } = {}) {
  if (!bbox || bbox.north == null || bbox.south == null || bbox.east == null || bbox.west == null) {
    return { stops: [], error: "missing-bbox" };
  }

  try {
    const res = await fetch("/api/rest-stops", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ bbox, vehicleType }),
    });
    if (!res.ok) {
      return { stops: [], error: res.status === 400 ? "invalid-bbox" : "failed" };
    }
    const data = await res.json();
    return { stops: data.stops || [], error: null };
  } catch {
    return { stops: [], error: "failed" };
  }
}
