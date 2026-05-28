/** Client fetch for /api/restaurants */
export async function fetchRestaurantsForStop({ lat, lng, city, answers, roadStop = false, limit = 6 }) {
  const res = await fetch("/api/restaurants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, city, answers, roadStop, limit }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.restaurants || [];
}

export async function fetchRestaurantsForStops(stops, answers, { roadStop = false, limit = 6 } = {}) {
  const out = {};
  await Promise.all(
    stops.map(async (stop) => {
      if (!stop.city || stop.lat == null || stop.lng == null) return;
      const list = await fetchRestaurantsForStop({
        lat: stop.lat,
        lng: stop.lng,
        city: stop.city,
        answers,
        roadStop,
        limit,
      });
      out[stop.city] = list;
    }),
  );
  return out;
}
