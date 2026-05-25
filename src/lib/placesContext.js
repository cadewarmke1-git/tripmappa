/** Pre-Sonnet corridor Places prefetch — anti-hallucination context for plan-trip. */
import { sampleRoutePointsEveryMiles, routePointAtFraction } from "./fuel.js";
import { searchGasStations } from "./placesStations.js";
import { geocodeCity, searchRestaurants, searchLodging, searchNearbyCategory, RADIUS_2MI } from "./placesSearch.js";
import { applyStopFilters } from "./placesFilters.js";
import { asArray } from "./tripAccommodations.js";
import { parseMilesFromDistance } from "./parsing.js";

const CORRIDOR_RADIUS_M = 1609; // 1 mile
const SAMPLE_INTERVAL_MI = 30;

function compactPlace(p) {
  return {
    name: p.name,
    address: p.address || "",
    rating: p.rating,
    distanceMi: p.distanceMiles,
    priceLevel: p.priceLevel,
    lat: p.lat,
    lng: p.lng,
  };
}

export function buildRouteBoundary(routeInfo) {
  if (!routeInfo?.routePoints?.length) return { samples: [], totalMiles: 0 };
  const samples = sampleRoutePointsEveryMiles(routeInfo.routePoints, SAMPLE_INTERVAL_MI);
  const totalMiles = parseMilesFromDistance(routeInfo.distance);
  return { samples, totalMiles, intervalMiles: SAMPLE_INTERVAL_MI };
}

export async function buildPlacesContext(answers, routeInfo) {
  if (!window.google?.maps?.places || !routeInfo?.routePoints?.length) {
    return { corridor: [], cities: [], boundary: { samples: [] } };
  }

  const boundary = buildRouteBoundary(routeInfo);
  const points = boundary.samples;
  const corridor = [];

  for (const pt of points) {
    if (pt.lat == null) continue;
    let gas = await searchGasStations(pt.lat, pt.lng, 8, CORRIDOR_RADIUS_M);
    gas = applyStopFilters(gas.map(g => ({ ...g, distanceMiles: g.distanceMiles })), answers);
    gas = gas.filter(g => (g.distanceMiles ?? 99) <= 1).slice(0, 3);

    let restaurants = await searchRestaurants(pt.lat, pt.lng, answers);
    restaurants = applyStopFilters(restaurants, answers)
      .filter(r => (r.distanceMiles ?? 99) <= 1)
      .slice(0, 4);

    corridor.push({
      lat: pt.lat,
      lng: pt.lng,
      gasStations: gas.map(compactPlace),
      restaurants: restaurants.map(r => ({
        ...compactPlace(r),
        isDetour: r.isDetour || false,
      })),
    });
  }

  const cities = [];
  const overnightCount = Math.max(1, (routeInfo.citiesAlongRoute || []).length > 0 ? 3 : 1);
  for (let i = 0; i < overnightCount; i++) {
    const frac = (i + 1) / (overnightCount + 1);
    const pt = routePointAtFraction(routeInfo.routePoints, frac);
    if (!pt?.lat) continue;
    let lodging = await searchLodging(pt.lat, pt.lng, answers, routeInfo);
    lodging = lodging.filter(h => (h.distanceMiles ?? 99) <= 1).slice(0, 4);
    const cityName = routeInfo.citiesAlongRoute?.[Math.min(i, (routeInfo.citiesAlongRoute.length - 1))] || `Route mile ~${Math.round(frac * (boundary.totalMiles || 0))}`;
    cities.push({
      city: cityName,
      lat: pt.lat,
      lng: pt.lng,
      hotels: lodging.map(compactPlace),
    });
  }

  const interests = asArray(answers?.stops_interests);
  if (interests.some(i => /playground|park/i.test(i))) {
    for (const pt of points.slice(0, Math.min(6, points.length))) {
      const parks = await searchNearbyCategory(pt.lat, pt.lng, {
        keyword: "playground park",
        radius: RADIUS_2MI,
        maxResults: 3,
      });
      const filtered = parks.filter(p => (p.distanceMiles ?? 99) <= 1);
      const last = corridor.find(c => c.lat === pt.lat && c.lng === pt.lng);
      if (last) last.playgrounds = filtered.map(compactPlace);
    }
  }

  return { corridor, cities, boundary, generatedAt: Date.now() };
}

export function formatRouteBoundaryForPrompt(routeInfo, boundary) {
  const b = boundary || buildRouteBoundary(routeInfo);
  if (!b.samples?.length) return "";
  const coordList = b.samples
    .map(p => `(${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})`)
    .join("\n  ");
  return `
ROUTE GPS BOUNDARY (mandatory — never violate):
The user's actual Google Directions polyline has been sampled every ${SAMPLE_INTERVAL_MI} miles at these coordinates:
  ${coordList}

CRITICAL RULES:
- ONLY suggest stops, cities, restaurants, fuel, and lodging within 1 mile of this coordinate corridor.
- NEVER suggest a location outside this boundary.
- NEVER place stops using only origin/destination city names — use these GPS coordinates.
- Every road_stop and overnight stop city MUST lie on this corridor.`;
}

export function formatPlacesContextForPrompt(ctx) {
  const lines = [];
  if (ctx?.boundary?.samples?.length) {
    lines.push(formatRouteBoundaryForPrompt(null, ctx.boundary));
  }
  if (!ctx?.corridor?.length && !ctx?.cities?.length) {
    lines.push("\n- placesContext: none available — use corridor GPS boundary only; keep names generic if unsure");
    return lines.join("\n");
  }
  lines.push("\nVERIFIED PLACES CONTEXT (use ONLY these real business names when suggesting stops in matching areas):");
  ctx.corridor?.forEach((seg, i) => {
    lines.push(`Corridor sample ${i + 1} @ ${seg.lat?.toFixed(4)}, ${seg.lng?.toFixed(4)}:`);
    if (seg.gasStations?.length) lines.push(`  Gas: ${seg.gasStations.map(g => g.name).join(", ")}`);
    if (seg.restaurants?.length) lines.push(`  Restaurants: ${seg.restaurants.map(r => r.name).join(", ")}`);
    if (seg.playgrounds?.length) lines.push(`  Parks/playgrounds: ${seg.playgrounds.map(p => p.name).join(", ")}`);
  });
  ctx.cities?.forEach(c => {
    if (c.hotels?.length) lines.push(`${c.city} hotels (on-route GPS): ${c.hotels.map(h => h.name).join(", ")}`);
  });
  lines.push("- Do NOT invent business names when a verified name exists above for that corridor segment.");
  return lines.join("\n");
}
