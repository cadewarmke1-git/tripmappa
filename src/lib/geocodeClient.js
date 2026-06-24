import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Client fetch for server-side geocoding. */
export async function fetchGeocode(address) {
  if (!address) return null;
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ address }),
  });
  if (!res.ok) return null;
  return res.json();
}

/** Cached reverse geocode via server (Supabase-backed grid key). */
export async function fetchReverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) return null;
  return res.json();
}
