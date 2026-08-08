import { tripMappaApiHeaders } from "./tripmappaHeaders.js";
import { recordNearbyCalls } from "./placesBudget.js";

/** Client fetch for /api/restaurants */
export async function fetchRestaurantsForStop({ lat, lng, city, answers, roadStop = false, limit = 6 }) {
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return { restaurants: [], error: "missing-location" };
  }

  try {
    const res = await fetch("/api/restaurants", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ lat, lng, city, answers, roadStop, limit }),
    });
    if (!res.ok) {
      if (res.status === 503) return { restaurants: [], error: "unavailable" };
      if (res.status === 400) return { restaurants: [], error: "missing-location" };
      if (res.status === 502) return { restaurants: [], error: "failed" };
      return { restaurants: [], error: "failed" };
    }
    const data = await res.json();
    const nearbyCallsBilled = Math.max(0, Number(data.nearbyCallsBilled) || 0);
    // Server-side resolve Nearby counts toward the trip budget; do not gate on cap.
    if (nearbyCallsBilled > 0) recordNearbyCalls(nearbyCallsBilled);
    return { restaurants: data.restaurants || [], error: null, nearbyCallsBilled };
  } catch {
    return { restaurants: [], error: "failed", nearbyCallsBilled: 0 };
  }
}
