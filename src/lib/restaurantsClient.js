/** Client fetch for /api/restaurants */
export async function fetchRestaurantsForStop({ lat, lng, city, answers, roadStop = false, limit = 6 }) {
  if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return { restaurants: [], error: "missing-location" };
  }

  try {
    const res = await fetch("/api/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, city, answers, roadStop, limit }),
    });
    if (!res.ok) {
      if (res.status === 503) return { restaurants: [], error: "unavailable" };
      if (res.status === 400) return { restaurants: [], error: "missing-location" };
      if (res.status === 502) return { restaurants: [], error: "failed" };
      return { restaurants: [], error: "failed" };
    }
    const data = await res.json();
    return { restaurants: data.restaurants || [], error: null };
  } catch {
    return { restaurants: [], error: "failed" };
  }
}
