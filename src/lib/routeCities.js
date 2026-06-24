/** Derive ordered corridor cities from a route polyline (e.g. HERE truck routes). */
import { sampleRoutePoints, encodeRoutePoints } from "./fuel.js";
import { parseMilesFromDistance } from "./parsing.js";
import { runWithConcurrency } from "./asyncPool.js";
import { fetchReverseGeocode } from "./geocodeClient.js";

const DEFAULT_CONCURRENCY = 5;
const MAX_CITIES = 15;

export function parseCityStateFromFormattedAddress(address) {
  if (!address) return null;
  const parts = String(address).split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  let city;
  let statePart;
  const last = parts[parts.length - 1];
  const hasCountrySuffix = parts.length >= 3 && /^(USA|United States)$/i.test(last);

  if (hasCountrySuffix) {
    city = parts[parts.length - 3] || parts[0];
    statePart = parts[parts.length - 2];
  } else {
    city = parts[parts.length - 2];
    statePart = parts[parts.length - 1];
  }

  const state = statePart.replace(/\s+\d{5}(-\d{4})?.*$/, "").trim();
  if (!city || !state) return null;
  return `${city}, ${state}`;
}

export function cityStateFromGeocodeComponents(components = []) {
  let city = null;
  let state = null;
  for (const component of components) {
    const types = component?.types || [];
    if (!city && (types.includes("locality") || types.includes("administrative_area_level_3"))) {
      city = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      state = component.short_name;
    }
  }
  return city && state ? `${city}, ${state}` : null;
}

function appendCorridorCity(list, cityState) {
  if (!cityState) return;
  const normalized = cityState.trim();
  if (!normalized) return;
  const last = list[list.length - 1];
  if (last && last.toLowerCase() === normalized.toLowerCase()) return;
  list.push(normalized);
}

function citiesFromDirectionsLegs(legs) {
  const cities = [];
  for (const leg of legs || []) {
    for (const step of leg.steps || []) {
      appendCorridorCity(cities, parseCityStateFromFormattedAddress(step.end_address));
    }
    appendCorridorCity(cities, parseCityStateFromFormattedAddress(leg.end_address));
  }
  return cities;
}

function reverseGeocodeCityState(lat, lng) {
  return fetchReverseGeocode(lat, lng).then(result => {
    if (result?.cityState) return result.cityState;
    if (!window.google?.maps || lat == null || lng == null) return null;
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status !== "OK" || !results?.[0]) {
          resolve(null);
          return;
        }
        resolve(cityStateFromGeocodeComponents(results[0].address_components || []));
      });
    });
  });
}

function buildSamplePoints(routePoints, distanceText) {
  const encoded = encodeRoutePoints(routePoints);
  if (!encoded.length) return [];
  if (encoded.length === 1) return encoded;

  const totalMiles = parseMilesFromDistance(distanceText);
  const interiorCount = totalMiles > 0
    ? Math.min(10, Math.max(3, Math.ceil(totalMiles / 120)))
    : 6;
  const interior = sampleRoutePoints(routePoints, interiorCount);
  const samples = [encoded[0], ...interior, encoded[encoded.length - 1]];

  const seen = new Set();
  return samples.filter((pt) => {
    const key = `${pt.lat?.toFixed(4)},${pt.lng?.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return pt.lat != null && pt.lng != null;
  });
}

/**
 * Reverse-geocode sampled polyline points into an ordered "City, ST" corridor list.
 * Falls back to parsing origin/destination when geocoding is unavailable.
 */
export async function deriveCitiesAlongRoute(routePoints, {
  origin,
  destination,
  distance,
  directionsLegs = null,
  concurrency = DEFAULT_CONCURRENCY,
  maxCities = MAX_CITIES,
} = {}) {
  const cities = [];
  appendCorridorCity(cities, parseCityStateFromFormattedAddress(origin));

  if (directionsLegs?.length) {
    for (const cityState of citiesFromDirectionsLegs(directionsLegs)) {
      appendCorridorCity(cities, cityState);
    }
    appendCorridorCity(cities, parseCityStateFromFormattedAddress(destination));
    return cities.slice(0, maxCities);
  }

  if (!Array.isArray(routePoints) || routePoints.length < 2) {
    appendCorridorCity(cities, parseCityStateFromFormattedAddress(destination));
    return cities.slice(0, maxCities);
  }

  if (!window.google?.maps) {
    appendCorridorCity(cities, parseCityStateFromFormattedAddress(destination));
    return cities.slice(0, maxCities);
  }

  const samples = buildSamplePoints(routePoints, distance);
  const geocoded = await runWithConcurrency(
    samples,
    concurrency,
    (pt) => reverseGeocodeCityState(pt.lat, pt.lng),
  );

  for (const cityState of geocoded) {
    appendCorridorCity(cities, cityState);
  }

  appendCorridorCity(cities, parseCityStateFromFormattedAddress(destination));
  return cities.slice(0, maxCities);
}
