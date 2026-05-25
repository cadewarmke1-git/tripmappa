/** Pre-Sonnet corridor Places prefetch — anti-hallucination context for plan-trip. */
import { sampleRoutePoints } from "./fuel.js";
import { searchGasStations } from "./placesStations.js";
import { geocodeCity, searchRestaurants, searchLodging, searchNearbyCategory, RADIUS_2MI } from "./placesSearch.js";
import { applyStopFilters } from "./placesFilters.js";
import { asArray } from "./tripAccommodations.js";

function compactPlace(p) {
  return {
    name: p.name,
    address: p.address || "",
    rating: p.rating,
    distanceMi: p.distanceMiles,
    priceLevel: p.priceLevel,
  };
}

export async function buildPlacesContext(answers, routeInfo) {
  if (!window.google?.maps?.places || !routeInfo?.routePoints?.length) {
    return { corridor: [], cities: [] };
  }

  const points = sampleRoutePoints(routeInfo.routePoints, Math.min(5, routeInfo.citiesAlongRoute?.length || 3));
  const corridor = [];

  for (const pt of points) {
    if (pt.lat == null) continue;
    let gas = await searchGasStations(pt.lat, pt.lng, 8, 1609);
    gas = applyStopFilters(gas.map(g => ({ ...g, distanceMiles: g.distanceMiles })), answers);
    gas = gas.filter(g => (g.distanceMiles ?? 99) <= 1).slice(0, 3);

    let restaurants = await searchRestaurants(pt.lat, pt.lng, answers);
    restaurants = applyStopFilters(restaurants, answers).slice(0, 4);

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
  const cityList = (routeInfo.citiesAlongRoute || []).slice(0, 6);
  for (const city of cityList) {
    const geo = await geocodeCity(city);
    if (!geo) continue;
    let lodging = await searchLodging(geo.lat, geo.lng, answers);
    lodging = lodging.slice(0, 4);
    cities.push({
      city,
      hotels: lodging.map(compactPlace),
    });
  }

  const interests = asArray(answers?.stops_interests);
  if (interests.some(i => /playground|park/i.test(i))) {
    for (const pt of points.slice(0, 3)) {
      const parks = await searchNearbyCategory(pt.lat, pt.lng, {
        keyword: "playground park",
        radius: RADIUS_2MI,
        maxResults: 3,
      });
      const last = corridor.find(c => c.lat === pt.lat);
      if (last) last.playgrounds = parks.map(compactPlace);
    }
  }

  return { corridor, cities, generatedAt: Date.now() };
}

export function formatPlacesContextForPrompt(ctx) {
  if (!ctx?.corridor?.length && !ctx?.cities?.length) {
    return "\n- placesContext: none available — use corridor cities only, keep names generic if unsure";
  }
  const lines = ["\nVERIFIED PLACES CONTEXT (use ONLY these real business names when suggesting stops in matching areas):"];
  ctx.corridor?.forEach((seg, i) => {
    lines.push(`Corridor point ${i + 1}:`);
    if (seg.gasStations?.length) lines.push(`  Gas: ${seg.gasStations.map(g => g.name).join(", ")}`);
    if (seg.restaurants?.length) lines.push(`  Restaurants: ${seg.restaurants.map(r => r.name).join(", ")}`);
    if (seg.playgrounds?.length) lines.push(`  Parks/playgrounds: ${seg.playgrounds.map(p => p.name).join(", ")}`);
  });
  ctx.cities?.forEach(c => {
    if (c.hotels?.length) lines.push(`${c.city} hotels: ${c.hotels.map(h => h.name).join(", ")}`);
  });
  lines.push("- Do NOT invent business names when a verified name exists above for that corridor segment.");
  return lines.join("\n");
}
