/** Shared Google Maps Platform key for serverless routes. */
export function getGoogleMapsKey() {
  return process.env.GOOGLE_MAPS_API_KEY || null;
}

export function photoUrl(photoReference, maxWidth = 800) {
  const key = getGoogleMapsKey();
  if (!key || !photoReference) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${key}`;
}
