/** Resolve ratings from LLM stops + Places enrichment. */
import { parseRating } from "./ratings.js";

function normalizeName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildRatingLookup(restaurantsByCity = {}) {
  const map = new Map();
  Object.values(restaurantsByCity).flat().forEach((r) => {
    const rating = parseRating(r?.rating);
    if (rating == null || !r?.name) return;
    map.set(normalizeName(r.name), { rating, userRatingsTotal: r.userRatingsTotal });
  });
  return map;
}

export function buildPlacesRatingLookup({ restaurantsByCity = {}, stops = [], roadStops = [], selectedLodging = [] } = {}) {
  const map = buildRatingLookup(restaurantsByCity);
  const add = (item) => {
    const rating = parseRating(item?.rating);
    if (rating == null || !item?.name) return;
    const key = normalizeName(item.name);
    if (!map.has(key)) map.set(key, { rating, userRatingsTotal: item.userRatingsTotal });
  };
  for (const stop of stops) {
    stop.hotels?.forEach(add);
    stop.restaurants?.forEach(add);
    stop.motels?.forEach(add);
    add(stop);
  }
  roadStops.forEach(add);
  selectedLodging.forEach(add);
  return map;
}

export function resolveEnrichedRating(entity, lookup) {
  const direct = parseRating(entity?.rating ?? entity?.stopData?.rating ?? null);
  if (direct != null) return direct;

  const name = entity?.name || entity?.title || entity?.stopData?.name;
  if (!name || !lookup) return null;
  const hit = lookup.get(normalizeName(name));
  return hit?.rating ?? null;
}
