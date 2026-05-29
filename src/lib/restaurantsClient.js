/** Client fetch for /api/restaurants */
export async function fetchRestaurantsForStop({ lat, lng, city, answers, roadStop = false, limit = 6 }) {
  const res = await fetch("/api/restaurants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, city, answers, roadStop, limit }),
  });
  if (!res.ok) {
    return { restaurants: [], error: res.status === 503 ? "unavailable" : "failed" };
  }
  const data = await res.json();
  return { restaurants: data.restaurants || [], error: null };
}

export async function fetchRestaurantsForStops(stops, answers, { roadStop = false, limit = 6 } = {}) {
  const out = {};
  await Promise.all(
    stops.map(async (stop) => {
      if (!stop.city || stop.lat == null || stop.lng == null) return;
      const { restaurants } = await fetchRestaurantsForStop({
        lat: stop.lat,
        lng: stop.lng,
        city: stop.city,
        answers,
        roadStop,
        limit,
      });
      out[stop.city] = restaurants;
    }),
  );
  return out;
}
