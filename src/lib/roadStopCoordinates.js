/** Attach lat/lng to itinerary road stops so map/nav never silently drop them. */
import { parseMilesFromDistance } from "./parsing.js";

/**
 * Build geocode queries for a road stop (most specific first).
 * @param {{ name?: string, title?: string, location?: string, city?: string }} rs
 * @returns {string[]}
 */
export function roadStopGeocodeQueries(rs) {
  const location = String(rs?.location || rs?.city || "").trim();
  const name = String(rs?.name || rs?.title || "").trim();
  const queries = [];
  if (name && location) {
    const cityOnly = location.split(",")[0].trim().toLowerCase();
    if (cityOnly && name.toLowerCase().includes(cityOnly)) {
      queries.push(`${name}`);
    } else {
      queries.push(`${name}, ${location}`);
    }
  } else if (name) {
    queries.push(name);
  }
  if (location && !queries.some((q) => q.toLowerCase() === location.toLowerCase())) {
    queries.push(location);
  }
  return queries.filter(Boolean);
}

/**
 * Visible fallback: place the stop on the driving polyline near its claimed mile marker.
 * @returns {{ lat: number, lng: number, source: "route_fallback" } | null}
 */
export function routeFallbackForRoadStop(rs, routePoints = [], totalMiles = null) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) return null;
  const claimed = parseMilesFromDistance(rs?.distance);
  const total = Number.isFinite(totalMiles) && totalMiles > 0
    ? totalMiles
    : (Number.isFinite(claimed) && claimed > 0 ? claimed : null);

  let idx;
  if (Number.isFinite(claimed) && total && total > 0) {
    const frac = Math.max(0, Math.min(1, claimed / total));
    idx = Math.round(frac * (routePoints.length - 1));
  } else {
    // No claimed distance — mid-corridor so the pin is still visible on the route
    idx = Math.floor((routePoints.length - 1) / 2);
  }
  const pt = routePoints[idx];
  if (pt?.lat == null || pt?.lng == null) return null;
  return { lat: Number(pt.lat), lng: Number(pt.lng), source: "route_fallback" };
}

function hasFiniteCoords(rs) {
  const lat = Number(rs?.lat);
  const lng = Number(rs?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/**
 * Ensure every road stop has lat/lng: existing → geocode → route polyline fallback.
 * Stops that still cannot be placed are left unchanged (caller may surface them).
 *
 * @param {object[]} roadStops
 * @param {{
 *   routePoints?: Array<{lat:number,lng:number}>,
 *   totalMiles?: number|null,
 *   geocode?: (address: string) => Promise<{lat?: number, lng?: number, formatted?: string}|null>,
 *   delay?: () => Promise<void>,
 *   signal?: AbortSignal,
 * }} [options]
 */
export async function ensureRoadStopCoordinates(roadStops = [], options = {}) {
  const {
    routePoints = [],
    totalMiles = null,
    geocode = null,
    delay = null,
    signal = null,
  } = options;

  const out = [];
  for (const rs of roadStops) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    if (hasFiniteCoords(rs)) {
      out.push({
        ...rs,
        lat: Number(rs.lat),
        lng: Number(rs.lng),
        coordSource: rs.coordSource || "existing",
        coordApprox: Boolean(rs.coordApprox),
      });
      continue;
    }

    let resolved = null;
    if (typeof geocode === "function") {
      for (const query of roadStopGeocodeQueries(rs)) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        try {
          const geo = await geocode(query);
          const lat = Number(geo?.lat);
          const lng = Number(geo?.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            resolved = {
              lat,
              lng,
              source: "geocode",
              formatted: geo.formatted || null,
            };
            break;
          }
        } catch {
          // try next query / fallback
        }
        if (typeof delay === "function") await delay();
      }
    }

    if (!resolved) {
      resolved = routeFallbackForRoadStop(rs, routePoints, totalMiles);
    }

    if (!resolved) {
      out.push({ ...rs });
      continue;
    }

    out.push({
      ...rs,
      lat: resolved.lat,
      lng: resolved.lng,
      coordSource: resolved.source,
      coordApprox: resolved.source === "route_fallback",
      geocodedAddress: resolved.formatted || rs.geocodedAddress || null,
    });

    if (resolved.source === "geocode" && typeof delay === "function") {
      await delay();
    }
  }
  return out;
}
