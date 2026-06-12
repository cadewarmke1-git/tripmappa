/** Build day-by-day trip structure from trip stops. */
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { parseRating, isLocalFavorite } from "./ratings.js";
import { skipLodgingQuestion, getEffectiveVehicle } from "./vehicles.js";
import { isContinuousDrive } from "./driveMode.js";
import { dedupeRoadStops } from "./placesDedup.js";
import { buildPlacesRatingLookup, resolveEnrichedRating } from "./placeRatings.js";
import { scheduleHintForDay } from "./scheduleRestrictions.js";
import { inferRoadStopCategory, chargingStopDetails } from "./roadStopCategory.js";

export function tripIncludesOvernight(stops = [], answers = {}) {
  if (isContinuousDrive(answers)) return false;
  const tripType = answers?.trip_type;
  if (tripType === "Day trip" || tripType === "Driving home") return false;
  const lodging = answers?.lodging;
  if (lodging === "No overnight stay" || lodging === "Sleeper cab — no hotel needed") return false;
  return stops.some(s => s?.city);
}

export function isSimplifiedTrip({ answers, routeInfo, stops = [], tripFormat }) {
  if (isContinuousDrive(answers)) return true;
  if (tripFormat === "simplified") return true;
  if (tripFormat === "multi_day") return false;
  const overnightCount = (stops || []).filter(s => s.city).length;
  if (overnightCount > 1) return false;
  const tripType = answers?.trip_type;
  const vehicle = getEffectiveVehicle(answers);
  if (skipLodgingQuestion(tripType, vehicle)) return true;
  const miles = parseMilesFromDistance(routeInfo?.distance) || 0;
  if (miles > 0 && miles < 150) return true;
  if (!stops.filter(s => s.city).length) return true;
  return false;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDayDate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function cityLabel(full) {
  if (!full) return "Stop";
  return full.split(",")[0].trim();
}

function distributeRoadStops(roadStops, dayCount) {
  if (!roadStops.length || dayCount < 1) return Array.from({ length: dayCount }, () => []);
  const perDay = Math.ceil(roadStops.length / dayCount);
  const out = [];
  for (let d = 0; d < dayCount; d++) {
    out.push(roadStops.slice(d * perDay, (d + 1) * perDay));
  }
  return out;
}

function inferCategory(rs) {
  return inferRoadStopCategory(rs);
}

function resolveRoadStopRating(rs) {
  const fromNote = String(rs.note || "").match(/(\d+\.?\d*)\s*star/i)?.[1];
  return parseRating(
    rs.rating
    ?? rs.stopData?.rating
    ?? fromNote,
  );
}

export function countTimelineStops({ stops = [], roadStops = [] }) {
  const overnightCount = stops.filter(s => s?.city).length;
  const roadCount = dedupeRoadStops(roadStops).length;
  return roadCount + overnightCount;
}

function mapRoadItem(rs, key, ratingLookup = null) {
  const rating = resolveEnrichedRating(rs, ratingLookup) ?? resolveRoadStopRating(rs);
  const placeId = rs.placeId || rs.place_id || rs.stopData?.placeId;
  const category = inferCategory(rs);
  const charging = category === "Charging" ? chargingStopDetails(rs) : null;
  const truckParking = rs.truck_parking ?? rs.stopData?.truck_parking;
  const descParts = [rs.note || rs.amenities];
  if (charging) {
    const chargeBits = [
      charging.network,
      charging.level,
      charging.chargeTime80 ? `${charging.chargeTime80} to 80%` : null,
      charging.ports != null ? `${charging.ports} ports` : null,
    ].filter(Boolean);
    if (chargeBits.length) descParts.unshift(chargeBits.join(" · "));
  }
  return {
    id: placeId || rs.id || `road-${key}`,
    placeId,
    type: "road",
    title: rs.name || rs.location || "Road stop",
    city: rs.location,
    category,
    description: descParts.filter(Boolean).join(" — ") || "A worthwhile stop along your route.",
    eta: rs.eta,
    distance: rs.distance,
    distanceFromRoute: rs.detourMiles ?? rs.distanceMiles,
    rating,
    photoUrl: rs.photoUrl,
    lat: rs.lat,
    lng: rs.lng,
    verified: rs.verified === true || rs.stopData?.verified === true,
    localFavorite: isLocalFavorite(rating),
    action: "add",
    stopData: rs,
    nearbyRestaurants: rs.nearbyRestaurants,
    truckParking: truckParking === true ? true : truckParking === false ? false : undefined,
    charging,
  };
}

function dayDrivingSummary(dayIdx, dayCount, routeInfo) {
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  const totalHours = parseHoursFromDuration(routeInfo?.duration) || 0;
  const milesPerDay = dayCount > 0 ? Math.round(totalMiles / dayCount) : totalMiles;
  const hoursPerDay = dayCount > 0 ? totalHours / dayCount : totalHours;
  const h = Math.floor(hoursPerDay);
  const m = Math.round((hoursPerDay % 1) * 60);
  return {
    miles: milesPerDay ? `${milesPerDay} mi` : "—",
    duration: hoursPerDay ? `${h}h ${m}m` : "—",
    dayIdx,
  };
}

export function buildItineraryDays({
  origin,
  dest,
  stops = [],
  roadStops = [],
  routeInfo,
  departureTime = null,
  answers = {},
  optionalStopCards = [],
  activitiesByCity = {},
  restaurantsByCity = {},
  recommendations = [],
}) {
  const dep = departureTime instanceof Date ? departureTime : (departureTime ? new Date(departureTime) : new Date());
  const overnightStops = stops.filter(s => s.city);
  const dayCount = Math.max(1, overnightStops.length || 1);
  const uniqueRoadStops = dedupeRoadStops(roadStops);
  const ratingLookup = buildPlacesRatingLookup({ restaurantsByCity, stops });
  const roadByDay = distributeRoadStops(uniqueRoadStops, overnightStops.length || 1);
  const days = [];

  if (overnightStops.length === 0) {
    const roadItems = [
      ...dedupeRoadStops(uniqueRoadStops).map((rs, i) => mapRoadItem(rs, i, ratingLookup)),
      ...optionalStopCards.slice(0, 3).map((p, i) => mapOptionalItem(p, i)),
    ];
    days.push({
      dayNumber: 1,
      label: "Day 1",
      date: formatDayDate(dep),
      scheduleHint: scheduleHintForDay(answers, dep, 0),
      drivingSummary: dayDrivingSummary(0, 1, routeInfo),
      roadStops: roadItems,
      overnight: null,
      activities: pickActivities(origin, activitiesByCity, restaurantsByCity, recommendations),
      overnightCity: null,
    });
    return days;
  }

  overnightStops.forEach((stop, dayIdx) => {
    const roadItems = (roadByDay[dayIdx] || []).map((rs, i) => mapRoadItem(rs, `${dayIdx}-${i}`, ratingLookup));
    if (dayIdx === 0 && optionalStopCards.length) {
      optionalStopCards.slice(0, 2).forEach((p, i) => roadItems.push(mapOptionalItem(p, i)));
    }

    days.push({
      dayNumber: dayIdx + 1,
      label: `Day ${dayIdx + 1}`,
      date: formatDayDate(addDays(dep, dayIdx)),
      scheduleHint: scheduleHintForDay(answers, dep, dayIdx),
      drivingSummary: dayDrivingSummary(dayIdx, overnightStops.length, routeInfo),
      roadStops: roadItems,
      overnight: {
        id: `overnight-${dayIdx}`,
        type: "overnight",
        title: cityLabel(stop.city),
        city: stop.city,
        description: stop.why || "Your home base for the night — rest up for tomorrow's drive.",
        eta: stop.eta,
        distance: stop.distance,
        rating: resolveEnrichedRating(stop, ratingLookup)
          ?? parseRating(stop.rating ?? stop.hotels?.[0]?.rating ?? stop.restaurants?.[0]?.rating),
        lat: stop.lat,
        lng: stop.lng,
        verified: stop.hotels?.some(h => h.verified) || stop.restaurants?.some(r => r.verified) || false,
        stopData: stop,
        action: "book",
      },
      activities: pickActivities(stop.city, activitiesByCity, restaurantsByCity, recommendations),
      overnightCity: stop.city,
      stopIndex: dayIdx,
    });
  });

  return days;
}

function pickActivities(city, activitiesByCity, restaurantsByCity, recommendations = []) {
  const fromRecs = recommendations.slice(0, 3).map((r, i) => ({
    id: r.id || `rec-${i}`,
    name: r.name,
    category: r.category || "Recommendation",
    rating: parseRating(r.rating),
    photoUrl: r.photoUrl,
    address: r.address || r.note,
    lat: r.lat,
    lng: r.lng,
    distanceMiles: r.distanceMiles,
  }));
  if (fromRecs.length) return fromRecs;
  const acts = activitiesByCity?.[city] || [];
  const rests = restaurantsByCity?.[city] || [];
  const merged = [
    ...acts.slice(0, 2).map(a => ({
      id: a.id,
      name: a.name,
      category: a.interest || "Activity",
      rating: parseRating(a.rating),
      photoUrl: a.photoUrl,
      address: a.address,
      lat: a.lat,
      lng: a.lng,
      distanceMiles: a.distanceMiles,
    })),
    ...rests.slice(0, 2).map(r => ({
      id: r.id,
      name: r.name,
      category: "Dining",
      rating: parseRating(r.rating),
      photoUrl: r.photoUrl,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      distanceMiles: r.distanceMiles,
    })),
  ];
  return merged.slice(0, 3);
}

function mapOptionalItem(p, i) {
  return {
    id: p.id || `opt-${i}`,
    type: "discovery",
    title: p.name,
    city: p.address,
    category: "Discovery",
    description: "A fun stretch break along your route.",
    distanceFromRoute: p.distanceMiles,
    distance: p.distanceMiles != null ? `${p.distanceMiles} mi off route` : null,
    rating: parseRating(p.rating),
    photoUrl: p.photoUrl,
    lat: p.lat,
    lng: p.lng,
    localFavorite: isLocalFavorite(p.rating),
    action: "add",
    stopData: p,
  };
}

export function countStitchedTimelineStops(days = []) {
  return days.reduce((sum, day) => {
    const road = (day.roadStops || []).length;
    const overnight = day.overnight ? 1 : 0;
    return sum + road + overnight;
  }, 0);
}

export function getItineraryOverview({
  origin,
  dest,
  routeInfo,
  stops,
  roadStops,
  budgetTotal,
  costEstimateLabel = null,
  answers = {},
  days = null,
}) {
  const miles = parseMilesFromDistance(routeInfo?.distance);
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const overnightCount = stops.filter(s => s.city).length;
  const straightThrough = isContinuousDrive(answers) && overnightCount === 0;
  const dayCount = straightThrough ? null : Math.max(1, overnightCount || 1);
  const stopCount = Array.isArray(days) && days.length
    ? countStitchedTimelineStops(days)
    : countTimelineStops({ stops, roadStops });
  return {
    origin: cityLabel(origin) || origin,
    destination: cityLabel(dest) || dest,
    tripName: `${cityLabel(origin) || origin} to ${cityLabel(dest) || dest}`,
    distance: routeInfo?.distance || (miles ? `${Math.round(miles)} mi` : "—"),
    duration: routeInfo?.duration || (hours ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m` : "—"),
    dayCount,
    stopCount,
    overnightCount,
    straightThrough,
    estimatedCost: budgetTotal,
    costEstimateLabel,
  };
}
