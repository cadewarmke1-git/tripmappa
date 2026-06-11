import {
  isTruckerTrip,
  isRvTrip,
  hasPref,
  isScenicRoute,
  skipLodgingQuestion,
  getEffectiveVehicle,
  parseTravelerCount,
} from "./vehicles.js";
import { computeHOSCompliance } from "./hos.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { isContinuousDrive, buildContinuousDriveTip } from "./driveMode.js";
import {
  STOPS_DATA,
  ROAD_STOPS_FALLBACK,
  TRUCK_STOPS_DATA,
  RV_STOPS_DATA,
  TRUCK_SAFETY_FALLBACK,
  RV_SAFETY_FALLBACK,
  normalizeRoadStop,
  mapHotelStops,
} from "./tripData.js";
import { normalizeTripTips } from "./tripTips.js";

/** Strip session-only fields before persisting or restoring saved trips. */
export function stripSessionOnlyAnswers(answers) {
  if (!answers || typeof answers !== "object") return {};
  const { travelers, kids_ages, inferredRestaurantHint, ...rest } = answers;
  return rest;
}

export function buildFallbackTripData(answers, routeInfo) {
  const effectiveVehicle = getEffectiveVehicle(answers);
  const isDayOrHome = skipLodgingQuestion(answers.trip_type, effectiveVehicle);
  const hours = routeInfo ? parseHoursFromDuration(routeInfo.duration) || 10 : 10;
  const partySize = parseTravelerCount(answers.travelers) ?? 2;
  const trucker = isTruckerTrip(answers);
  const rv = isRvTrip(answers);
  const hos = trucker ? computeHOSCompliance(hours) : null;

  let stops = [];
  let roadStops = [];
  let truckSafety = null;
  let rvSafety = null;

  if (trucker) {
    truckSafety = {
      ...TRUCK_SAFETY_FALLBACK,
      estimatedFuelGal: routeInfo?.distance ? Math.ceil((parseMilesFromDistance(routeInfo.distance) || 0) / 6) : 180,
    };
    const numStops = hos ? Math.max(1, hos.overnightStopsRequired) : 2;
    stops = TRUCK_STOPS_DATA.slice(0, numStops).map(s => ({
      city: s.city, distance: s.distance, eta: s.eta,
      truckStop: s.truckStop, motel: s.motel, restArea: s.restArea, fuelStops: s.fuelStops,
    }));
    roadStops = TRUCK_STOPS_DATA.flatMap(s => s.fuelStops.map(f => normalizeRoadStop({
      location: f.location, distance: f.distance, eta: "—", category: "fuel",
      name: f.name, note: `${f.diesel} · ${f.amenities}`, diesel: f.diesel, amenities: f.amenities,
    })));
  } else if (rv) {
    const miles = routeInfo?.distance ? parseMilesFromDistance(routeInfo.distance) || 0 : 500;
    rvSafety = {
      ...RV_SAFETY_FALLBACK,
      estimatedFuelGal: Math.ceil(miles / 9),
      towing: answers.rv_towing === "Yes",
    };
    const numStops = hours <= 8 ? 1 : hours <= 16 ? 2 : 3;
    stops = RV_STOPS_DATA.slice(0, numStops).map(s => ({
      city: s.city, distance: s.distance, eta: s.eta,
      rvPark: s.rvPark, campground: s.campground, freeParking: s.freeParking, fuelStops: s.fuelStops,
    }));
    roadStops = RV_STOPS_DATA.flatMap(s => s.fuelStops.map(f => normalizeRoadStop({
      location: f.location, distance: f.distance, eta: "—", category: "fuel",
      name: f.name, note: `${f.fuel} · ${f.amenities}`,
      fuel: f.fuel, highClearance: f.highClearance, rvFriendly: f.rvFriendly, def: f.def, amenities: f.amenities,
    })));
  } else if (isContinuousDrive(answers)) {
    stops = [];
    roadStops = ROAD_STOPS_FALLBACK.map(normalizeRoadStop);
  } else if (isDayOrHome) {
    roadStops = [];
  } else {
    const numStops = hours <= 6 ? 1 : hours <= 12 ? 2 : hours <= 20 ? 3 : 4;
    stops = STOPS_DATA.slice(0, numStops).map(s => ({
      ...s,
      hotels: s.hotels.map(h => ({
        ...h,
        petFriendly: hasPref(answers, "Pet friendly"),
      })),
      scenicView: isScenicRoute(answers) ? "Scenic viewpoint nearby" : null,
    }));
    roadStops = [];
  }

  const tips = [];
  if (trucker && hos) {
    tips.push(`HOS Compliant Route — ${hos.drivingDays} driving day${hos.drivingDays > 1 ? "s" : ""}, ${hos.overnightStopsRequired} overnight stop${hos.overnightStopsRequired !== 1 ? "s" : ""} required by federal law`);
    if (hos.forcedStopNote) tips.push(hos.forcedStopNote);
    tips.push(`Based on federal HOS regulations this route requires ${hos.overnightStopsRequired || 1} overnight stop${(hos.overnightStopsRequired || 1) !== 1 ? "s" : ""}.`);
  }
  if (rv) {
    tips.push("RV Safe Route — low bridges under 14ft flagged along your route");
    if (answers.rv_towing === "Yes") {
      tips.push("Towing mode: extra length restrictions applied — unhitch zones and large parking areas noted");
      tips.push("Check state towing speed limits along your route (typically 55–65 mph when towing)");
    }
    tips.push("Dump station locations noted between overnight stops");
  }
  if (partySize >= 6) {
    tips.push("Large party — request appropriate table sizes at restaurant stops.");
  }
  if (isScenicRoute(answers)) tips.push("Scenic viewpoints and photo spots noted near each stop.");
  if (hasPref(answers, "Pet friendly")) tips.push("Pet relief areas flagged at rest stops along your route.");
  if (isContinuousDrive(answers)) {
    tips.push(buildContinuousDriveTip(routeInfo));
    tips.push("Fuel and rest stops prioritized for long-haul driving — no overnight lodging on this trip.");
  }
  if (!tips.length) tips.push("Check weather and road conditions before you leave", "Allow extra time at major interchanges");

  return { stops, roadStops, tripTips: tips, hosCompliance: hos, truckSafety, rvSafety };
}

export function parseTripApiResponse(data, answers, routeInfo, fallbackFn) {
  const continuous = isContinuousDrive(answers);
  const hasStopLabel = (s) => s && (s.city || s.name || s.location);
  const apiStops = continuous
    ? []
    : (Array.isArray(data.stops) ? data.stops.filter(hasStopLabel) : []);
  const apiRoadStops = (Array.isArray(data.road_stops) ? data.road_stops : [])
    .filter(hasStopLabel)
    .map(s => normalizeRoadStop({ ...s, fromLlm: true }));

  const metaFields = {
    hosCompliance: data.hos_compliance || data.hosCompliance || null,
    truckSafety: data.safety?.truck || data.truck_safety || null,
    rvSafety: data.safety?.rv || data.rv_safety || null,
    routeSummary: data.route_summary || null,
    roadConditionWarnings: data.road_condition_warnings || [],
    personalTouches: Array.isArray(data.personal_touches) ? data.personal_touches.filter(Boolean) : [],
    changesMade: Array.isArray(data.changes_made) ? data.changes_made.filter(Boolean) : [],
  };

  if (apiStops.length > 0) {
    return {
      stops: mapHotelStops(apiStops),
      roadStops: apiRoadStops,
      tripTips: normalizeTripTips(data.tips),
      tripFormat: data.trip_format || "multi_day",
      recommendations: data.recommendations || [],
      usedFallback: false,
      ...metaFields,
    };
  }
  if (apiRoadStops.length > 0 || continuous) {
    return {
      stops: [],
      roadStops: apiRoadStops,
      tripTips: normalizeTripTips(data.tips),
      tripFormat: continuous ? "simplified" : (data.trip_format || "simplified"),
      recommendations: data.recommendations || [],
      usedFallback: false,
      ...metaFields,
    };
  }
  const fallback = fallbackFn(answers, routeInfo);
  return {
    stops: fallback.stops,
    roadStops: fallback.roadStops,
    tripTips: fallback.tripTips,
    tripFormat: "simplified",
    recommendations: [],
    hosCompliance: fallback.hosCompliance,
    truckSafety: fallback.truckSafety,
    rvSafety: fallback.rvSafety,
    usedFallback: true,
  };
}
