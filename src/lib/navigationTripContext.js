/** Trip-aware context for turn-by-turn navigation — uses only existing trip data. */
import { dietaryMatchesRestaurant } from "./dietaryKeywords.js";
import { getFuelRangeMiles } from "./tripAccommodations.js";
import { getFuelStopMode, isFuelCategoryRoadStop } from "./fuel.js";
import { getEffectiveVehicle, isRvVehicle, isTruckVehicle } from "./vehicles.js";
import { parseMilesFromDistance } from "./parsing.js";
import { haversineMeters } from "./navigationGeometry.js";
import {
  buildProximityTips,
  findProximityTip,
  PROXIMITY_ALERT_RADIUS_MILES,
} from "./proximityTripTips.js";

export function findCityData(map, city) {
  if (!city || !map) return null;
  if (map[city]) return map[city];
  const key = Object.keys(map).find((k) =>
    k.split(",")[0].trim().toLowerCase() === city.split(",")[0].trim().toLowerCase(),
  );
  return key ? map[key] : null;
}

function cityLabel(city) {
  if (!city) return "";
  return city.split(",")[0].trim();
}

function stopKindLabel(waypoint) {
  if (!waypoint) return "Stop";
  if (waypoint.role === "overnight") return "Overnight";
  if (waypoint.kind === "destination") return "Destination";
  const cat = (waypoint.category || waypoint.stopData?.category || "").toLowerCase();
  if (cat === "fuel" || cat === "charging") return cat === "charging" ? "EV charge" : "Fuel";
  if (cat === "food" || cat === "restaurant") return "Meal";
  if (cat === "lodging") return "Lodging";
  if (cat === "scenic" || cat === "attraction") return "Scenic";
  if (cat === "rest") return "Rest";
  return "Planned stop";
}

function lodgingForCity(selectedLodging, city) {
  if (!city || !selectedLodging?.length) return null;
  const label = cityLabel(city).toLowerCase();
  return selectedLodging.find((l) => {
    const lc = (l.city || l.location || "").toLowerCase();
    return lc.includes(label) || label.includes(lc.split(",")[0].trim());
  }) || null;
}

function dietaryRestaurantForCity(restaurantsByCity, city, answers) {
  const list = findCityData(restaurantsByCity, city);
  if (!Array.isArray(list) || !list.length) return null;
  const match = list.find((r) => dietaryMatchesRestaurant(r, answers));
  return match || list[0];
}

function fractionAlongRoute(point, routePoints) {
  if (!point?.lat || !routePoints?.length) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  routePoints.forEach((pt, idx) => {
    const d = haversineMeters(point.lat, point.lng, pt.lat, pt.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  });
  return routePoints.length > 1 ? bestIdx / (routePoints.length - 1) : 0;
}

function fuelStopsAlongRoute(roadStops, routePoints) {
  return (roadStops || [])
    .filter((s) => isFuelCategoryRoadStop(s) && s.lat != null && s.lng != null)
    .map((s) => ({
      ...s,
      fraction: fractionAlongRoute(s, routePoints),
      title: s.name || s.title || s.location || "Fuel stop",
    }))
    .sort((a, b) => a.fraction - b.fraction);
}

/** Context card for the next planned corridor stop. */
export function buildNextStopContext(nextWaypoint, {
  selectedLodging = [],
  weatherByCity = {},
  restaurantsByCity = {},
  answers = {},
} = {}) {
  if (!nextWaypoint) return null;

  const city = nextWaypoint.city || nextWaypoint.stopData?.city;
  const weather = findCityData(weatherByCity, city);
  const lodging = nextWaypoint.role === "overnight" ? lodgingForCity(selectedLodging, city) : null;
  const restaurant = nextWaypoint.role === "overnight"
    ? dietaryRestaurantForCity(restaurantsByCity, city, answers)
    : null;

  const dietary = Array.isArray(answers.dietary) ? answers.dietary.filter(Boolean) : [];
  const hasDietary = dietary.length > 0 && !dietary.includes("No restrictions");

  const lines = [];
  if (lodging?.name) lines.push({ type: "lodging", text: lodging.name });
  else if (nextWaypoint.role === "overnight" && answers?.lodging) {
    lines.push({ type: "lodging", text: answers.lodging });
  }
  if (restaurant?.name) {
    const prefix = hasDietary && dietaryMatchesRestaurant(restaurant, answers) ? "Dinner pick" : "Nearby";
    lines.push({ type: "meal", text: `${prefix}: ${restaurant.name}` });
  }
  if (nextWaypoint.description && !lines.length) {
    lines.push({ type: "note", text: nextWaypoint.description });
  }

  return {
    title: nextWaypoint.title || cityLabel(city) || "Next stop",
    kind: stopKindLabel(nextWaypoint),
    city: cityLabel(city),
    weather: weather?.temperatureDisplay
      ? { temp: weather.temperatureDisplay, condition: weather.condition }
      : null,
    lines,
  };
}

/** Fuel / EV range advisory based on vehicle profile and planned fuel stops. */
export function buildFuelRangeAdvisory({
  userPosition = null,
  answers = {},
  roadStops = [],
  routePoints = [],
  routeInfo = null,
  passedStopIds = new Set(),
} = {}) {
  const mode = getFuelStopMode(answers);
  if (mode === "none" || !userPosition || !routePoints?.length) return null;

  const rangeMi = getFuelRangeMiles(answers);
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  const currentFrac = fractionAlongRoute(userPosition, routePoints);
  const milesFromStart = totalMiles * currentFrac;

  const fuelStops = fuelStopsAlongRoute(roadStops, routePoints);
  const passedFuels = fuelStops.filter((s) => passedStopIds.has(s.id));
  const lastFuelFrac = passedFuels.length
    ? passedFuels[passedFuels.length - 1].fraction
    : 0;
  const milesSinceFuel = Math.max(0, (currentFrac - lastFuelFrac) * totalMiles);
  const rangeLeft = Math.max(0, Math.round(rangeMi - milesSinceFuel));

  const ahead = fuelStops.find((s) => s.fraction > currentFrac + 0.001 && !passedStopIds.has(s.id));
  const distToNextFuelMi = ahead
    ? haversineMeters(userPosition.lat, userPosition.lng, ahead.lat, ahead.lng) / 1609.34
    : null;

  const vehicle = getEffectiveVehicle(answers);
  const isEv = mode === "ev" || mode === "hybrid";
  const fuelLabel = isEv ? "charge" : (mode === "diesel" ? "diesel" : "fuel");

  let level = "ok";
  if (rangeLeft < 40 || (distToNextFuelMi != null && distToNextFuelMi > rangeLeft)) {
    level = "warn";
  } else if (rangeLeft < 80) {
    level = "caution";
  }

  const parts = [];
  if (isEv) {
    parts.push(`~${rangeLeft} mi estimated range`);
  } else if (isRvVehicle(vehicle)) {
    parts.push(`~${rangeLeft} mi until ${fuelLabel} — RV range`);
  } else if (isTruckVehicle(vehicle)) {
    parts.push(`~${rangeLeft} mi until ${fuelLabel}`);
  } else {
    parts.push(`~${rangeLeft} mi of ${fuelLabel} range left`);
  }

  if (ahead && distToNextFuelMi != null) {
    const distLabel = distToNextFuelMi < 1
      ? "less than 1 mi"
      : `${Math.round(distToNextFuelMi)} mi`;
    parts.push(`Planned ${isEv ? "charger" : "stop"}: ${ahead.title} in ${distLabel}`);
  } else if (milesFromStart > rangeMi * 0.6 && fuelStops.length === 0) {
    parts.push("No planned fuel stops on this leg — watch your gauge");
  }

  return {
    level,
    message: parts.join(" · "),
    rangeLeftMi: rangeLeft,
    nextFuelStop: ahead?.title || null,
    distToNextFuelMi: distToNextFuelMi != null ? Math.round(distToNextFuelMi) : null,
  };
}

/** Nearest trip-specific corridor alert (weather, construction, traffic tips). */
export function findCorridorAlert({
  userPosition = null,
  tripTips = [],
  liveTripTips = [],
  tripAlerts = [],
  weatherByCity = {},
  routePoints = [],
  handledIds = new Set(),
} = {}) {
  if (!userPosition) return null;
  const tips = buildProximityTips({
    tripTips,
    liveTripTips,
    tripAlerts,
    weatherByCity,
    routePoints,
  });
  return findProximityTip(userPosition, tips, handledIds, PROXIMITY_ALERT_RADIUS_MILES);
}

/** Richer arrival banner when reaching a planned stop. */
export function buildArrivalContext(arrivingStop, ctx) {
  if (!arrivingStop) return null;
  const base = buildNextStopContext(arrivingStop, ctx);
  if (!base) return { title: arrivingStop.title, subtitle: null };
  const subtitle = base.lines.map((l) => l.text).join(" · ") || null;
  return { title: base.title, subtitle, kind: base.kind, weather: base.weather };
}
