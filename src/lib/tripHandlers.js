import {
  isTruckerTrip,
  isRvTrip,
  hasFamilyKids,
  hasPref,
  isScenicRoute,
  skipLodgingQuestion,
} from "./vehicles.js";
import { hasKidsToddlers } from "./tripFlow.js";
import { computeHOSCompliance } from "./hos.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
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

export function buildFallbackTripData(answers, routeInfo) {
  const isDayOrHome = skipLodgingQuestion(answers.trip_type);
  const hours = routeInfo ? parseHoursFromDuration(routeInfo.duration) || 10 : 10;
  const hasKids = hasFamilyKids(answers.travelers);
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
  } else if (isDayOrHome) {
    const dayRoadStops = hasKids ? [...ROAD_STOPS_FALLBACK, ...ROAD_STOPS_FALLBACK.slice(0, 2)] : ROAD_STOPS_FALLBACK;
    roadStops = dayRoadStops.map(s => ({
      ...normalizeRoadStop(s),
      kidFriendly: hasKids,
      petRelief: hasPref(answers, "Pet-friendly stops"),
      scenic: isScenicRoute(answers),
    }));
  } else {
    const numStops = hours <= 6 ? 1 : hours <= 12 ? 2 : hours <= 20 ? 3 : 4;
    stops = STOPS_DATA.slice(0, numStops).map(s => ({
      ...s,
      hotels: s.hotels.map(h => ({
        ...h,
        kidFriendly: hasKids && hasPref(answers, "Kid-friendly stops"),
        petFriendly: hasPref(answers, "Pet-friendly stops"),
      })),
      scenicView: isScenicRoute(answers) ? "Scenic viewpoint nearby" : null,
    }));
    roadStops = ROAD_STOPS_FALLBACK.slice(0, hasKids ? 5 : 3).map(s => normalizeRoadStop({
      ...s, kidFriendly: hasKids, scenic: isScenicRoute(answers),
    }));
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
  if (hasKids) {
    tips.push("Kid-friendly stops prioritized along your route");
    tips.push("Rest stops suggested every 2 hours for young travelers.");
    if (hasKidsToddlers(answers.kids_ages)) tips.push("Diaper changing stations noted at rest stops");
  }
  if (isScenicRoute(answers)) tips.push("Scenic viewpoints and photo spots noted near each stop.");
  if (hasPref(answers, "Pet-friendly stops")) tips.push("Pet relief areas flagged at rest stops along your route.");
  if (!tips.length) tips.push("Check weather and road conditions before you leave", "Allow extra time at major interchanges");

  return { stops, roadStops, tripTips: tips, hosCompliance: hos, truckSafety, rvSafety };
}

export function parseTripApiResponse(data, answers, routeInfo, fallbackFn) {
  const apiStops = Array.isArray(data.stops) ? data.stops.filter(s => s && (s.city || s.name)) : [];
  const apiRoadStops = (Array.isArray(data.road_stops) ? data.road_stops : []).map(normalizeRoadStop);

  if (apiStops.length > 0) {
    return {
      stops: mapHotelStops(apiStops),
      roadStops: apiRoadStops,
      tripTips: Array.isArray(data.tips) && data.tips.length ? data.tips : [],
      usedFallback: false,
    };
  }
  if (apiRoadStops.length > 0) {
    return {
      stops: [],
      roadStops: apiRoadStops,
      tripTips: Array.isArray(data.tips) && data.tips.length ? data.tips : [],
      usedFallback: false,
    };
  }
  const fallback = fallbackFn(answers, routeInfo);
  return {
    stops: fallback.stops,
    roadStops: fallback.roadStops,
    tripTips: fallback.tripTips,
    hosCompliance: fallback.hosCompliance,
    truckSafety: fallback.truckSafety,
    rvSafety: fallback.rvSafety,
    usedFallback: true,
  };
}
