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

export function getPolygonBounds(polygon) {
  if (!polygon?.length) return null;
  let north = polygon[0].lat;
  let south = polygon[0].lat;
  let east = polygon[0].lng;
  let west = polygon[0].lng;
  for (const p of polygon) {
    north = Math.max(north, p.lat);
    south = Math.min(south, p.lat);
    east = Math.max(east, p.lng);
    west = Math.min(west, p.lng);
  }
  return { north, south, east, west };
}

export function getPolygonCentroid(polygon) {
  if (!polygon?.length) return null;
  let lat = 0;
  let lng = 0;
  for (const p of polygon) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / polygon.length, lng: lng / polygon.length };
}

export function approxPolygonRadiusMeters(polygon, center) {
  if (!polygon?.length || !center) return 50000;
  let maxMeters = 0;
  for (const p of polygon) {
    const dLat = (p.lat - center.lat) * Math.PI / 180;
    const dLng = (p.lng - center.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(center.lat * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const meters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (meters > maxMeters) maxMeters = meters;
  }
  return Math.min(500000, Math.max(5000, Math.round(maxMeters)));
}

const LOCALITY_TYPES = new Set([
  "locality",
  "postal_town",
  "administrative_area_level_3",
  "sublocality",
  "sublocality_level_1",
  "neighborhood",
]);

function isLocalityPlace(place) {
  const types = place?.types || [];
  return types.some(t => LOCALITY_TYPES.has(t));
}

function nearbySearch(request) {
  return new Promise((resolve) => {
    if (!window.google?.maps?.places) {
      resolve([]);
      return;
    }
    const container = document.createElement("div");
    const service = new window.google.maps.places.PlacesService(container);
    service.nearbySearch(request, (results, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });
}

export async function searchPlacesInPolygon(polygon, center) {
  if (!polygon?.length || !center || !window.google?.maps) return [];

  const radius = approxPolygonRadiusMeters(polygon, center);
  const samplePoints = [
    center,
    getPolygonCentroid(polygon),
  ].filter(Boolean);

  const bounds = getPolygonBounds(polygon);
  if (bounds) {
    samplePoints.push(
      { lat: bounds.north, lng: center.lng },
      { lat: bounds.south, lng: center.lng },
      { lat: center.lat, lng: bounds.east },
      { lat: center.lat, lng: bounds.west },
    );
  }

  const seen = new Map();
  const searches = samplePoints.slice(0, 5).map(pt => nearbySearch({
    location: pt,
    radius: Math.min(radius, 50000),
  }));

  const batches = await Promise.all(searches);
  for (const batch of batches) {
    for (const place of batch) {
      if (!isLocalityPlace(place)) continue;
      const lat = place.geometry?.location?.lat?.();
      const lng = place.geometry?.location?.lng?.();
      if (lat == null || lng == null) continue;
      if (!pointInPolygon(lat, lng, polygon)) continue;
      const id = place.place_id || `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (seen.has(id)) continue;
      seen.set(id, {
        id,
        name: place.name,
        lat,
        lng,
        address: place.vicinity || place.formatted_address || "",
      });
    }
  }

  return [...seen.values()].slice(0, 24);
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
