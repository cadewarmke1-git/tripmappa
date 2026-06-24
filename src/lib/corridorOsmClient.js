import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Client fetch for /api/corridor-osm (fuel, restaurants, lodging, truck stops). */
export async function fetchCorridorOsmForBbox({ bbox } = {}) {
  if (!bbox || bbox.north == null || bbox.south == null || bbox.east == null || bbox.west == null) {
    return { places: [], error: "missing-bbox" };
  }

  try {
    const res = await fetch("/api/corridor-osm", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ bbox }),
    });
    if (!res.ok) {
      return { places: [], error: res.status === 400 ? "invalid-bbox" : "failed" };
    }
    const data = await res.json();
    return { places: data.places || [], error: null, cached: data.cached === true };
  } catch {
    return { places: [], error: "failed" };
  }
}
