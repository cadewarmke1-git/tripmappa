/** Client helpers for hero explore-range isoline and place discovery. */

export async function fetchIsoline(originLat, originLng, driveTimeSeconds, { signal } = {}) {
  const res = await fetch("/api/isoline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originLat, originLng, driveTimeSeconds }),
    signal,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid isoline response");
  }
  if (!res.ok) {
    throw new Error(data.error || "Could not load explore range");
  }
  return data;
}

export function pointInPolygon(lat, lng, polygon) {
  if (!polygon?.length || !window.google?.maps?.geometry?.poly) {
    return rayCastPointInPolygon(lat, lng, polygon);
  }
  return window.google.maps.geometry.poly.containsLocation(
    { lat, lng },
    new window.google.maps.Polygon({ paths: polygon }),
  );
}

function rayCastPointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function reverseGeocodeLatLng(lat, lng) {
  return new Promise((resolve) => {
    if (!window.google?.maps) {
      resolve(null);
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }
      resolve(results[0].formatted_address || null);
    });
  });
}

export async function resolveHeroOriginCoords(text, autocompleteInstance) {
  if (!window.google?.maps) return null;

  if (autocompleteInstance) {
    const selected = autocompleteInstance.getPlace();
    if (selected?.geometry?.location) {
      const lat = selected.geometry.location.lat();
      const lng = selected.geometry.location.lng();
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, address: selected.formatted_address || text };
      }
    }
  }

  if (!text?.trim()) return null;

  return new Promise((resolve) => {
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: text.trim() }, (results, status) => {
      if (status !== "OK" || !results?.[0]?.geometry?.location) {
        resolve(null);
        return;
      }
      const loc = results[0].geometry.location;
      resolve({
        lat: loc.lat(),
        lng: loc.lng(),
        address: results[0].formatted_address || text.trim(),
      });
    });
  });
}
