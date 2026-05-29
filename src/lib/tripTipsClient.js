/** Client fetch for /api/trip-tips */
export async function fetchLiveTripTips({ origin, destination, routePoints = [], waypoints = [] }) {
  if (!origin || !destination) {
    return { tips: [], updatedAt: null, cached: false };
  }

  const res = await fetch("/api/trip-tips", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination, routePoints, waypoints }),
  });

  if (!res.ok) return { tips: [], updatedAt: null, cached: false };
  const data = await res.json();
  return {
    tips: Array.isArray(data.tips) ? data.tips.slice(0, 5) : [],
    updatedAt: data.updatedAt || Date.now(),
    cached: Boolean(data.cached),
  };
}
