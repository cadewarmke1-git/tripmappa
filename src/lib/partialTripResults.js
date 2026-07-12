import { isContinuousDrive } from "./driveMode.js";
import { isTruckerTrip } from "./vehicles.js";

function findCityData(map, city) {
  if (!city || !map) return null;
  if (map[city]) return map[city];
  const key = Object.keys(map).find((k) =>
    k.split(",")[0].trim().toLowerCase() === city.split(",")[0].trim().toLowerCase(),
  );
  return key ? map[key] : null;
}

function overnightCities(days = []) {
  return [...new Set(days.map((d) => d?.overnight?.city).filter(Boolean))];
}

/** True when results may be incomplete — non-blocking warning only. */
export function detectPartialTripResults({
  stops = [],
  roadStops = [],
  answers = {},
  days = [],
  restaurantsByCity = {},
  enrichingTrip = false,
  enrichingPlaces = false,
}) {
  if (enrichingTrip || enrichingPlaces) return false;

  const stopCount = (stops?.length || 0) + (roadStops?.length || 0);
  if (stopCount < 2) return true;

  const continuousDrive = isContinuousDrive(answers);
  const cities = overnightCities(days);
  const expectsOvernightSections = cities.length > 0 && !continuousDrive;

  if (!expectsOvernightSections) return false;

  const sleeperOnly = isTruckerTrip(answers)
    && answers?.lodging === "Sleeper cab — no hotel needed";

  if (!sleeperOnly) {
    const hasLodgingStops = (stops || []).some((s) =>
      s?.category === "lodging" || s?.lodging || s?.type === "lodging",
    );
    if (!hasLodgingStops) return true;
  }

  const hasRestaurants = cities.some((city) => {
    const data = findCityData(restaurantsByCity, city);
    return Array.isArray(data) && data.length > 0;
  });
  if (!hasRestaurants) return true;

  return false;
}
