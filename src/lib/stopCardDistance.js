/** Human-readable distance line for stop cards (v0 spec). */
export function formatOffRouteDistance(miles) {
  if (miles == null || miles === "") return null;
  const n = typeof miles === "number" ? miles : parseFloat(String(miles).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return String(miles);
  if (n <= 0.05) return "On route";
  const rounded = n % 1 === 0 ? String(n) : n.toFixed(1);
  return `${rounded} mi off route`;
}

export function buildDirectionsUrl(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
