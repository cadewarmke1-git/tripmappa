/** Server-side geocoding via Google Geocoding API. */
import { getGoogleMapsKey } from "./googleKey.js";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export async function geocodeAddress(address) {
  const key = getGoogleMapsKey();
  if (!key || !address) return null;

  const params = new URLSearchParams({ key, address });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) return null;

  const loc = data.results[0].geometry.location;
  return {
    lat: loc.lat,
    lng: loc.lng,
    formatted: data.results[0].formatted_address,
  };
}
