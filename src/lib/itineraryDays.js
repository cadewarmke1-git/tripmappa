/** Build day-by-day trip structure from trip stops. */
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { parseRating, isLocalFavorite } from "./ratings.js";
import { skipLodgingQuestion, getEffectiveVehicle } from "./vehicles.js";

export function isSimplifiedTrip({ answers, routeInfo, stops = [], tripFormat }) {
  if (tripFormat === "simplified") return true;
  if (tripFormat === "multi_day") return false;
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
  const cat = (rs.category || "").toLowerCase();
  if (/fuel|gas|diesel|ev|charge/i.test(cat)) return "Fuel";
  if (/food|rest|dining|meal/i.test(cat)) return "Food";
  if (/discovery|attraction|scenic/i.test(cat)) return "Discovery";
  if (/rest|break/i.test(cat)) return "Rest";
  if (/fuel|pilot|love'?s|shell|chevron|ta\b/i.test(rs.name || "")) return "Fuel";
  if (/mcdonald|starbucks|restaurant|diner|food/i.test(rs.name || rs.note || "")) return "Food";
  return "Rest";
}

function mapRoadItem(rs, key) {
  const rating = parseRating(rs.rating ?? String(rs.note || "").match(/(\d+\.?\d*)\s*star/i)?.[1]);
  return {
    id: rs.id || `road-${key}`,
    type: "road",
    title: rs.name || rs.location || "Road stop",
    city: rs.location,
    category: inferCategory(rs),
    description: rs.note || rs.amenities || "A worthwhile stop along your route.",
    eta: rs.eta,
    distance: rs.distance,
    distanceFromRoute: rs.detourMiles ?? rs.distanceMiles,
    rating,
    photoUrl: rs.photoUrl,
    lat: rs.lat,
    lng: rs.lng,
    localFavorite: isLocalFavorite(rating),
    action: "add",
    stopData: rs,
    nearbyRestaurants: rs.nearbyRestaurants,
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
  optionalStopCards = [],
  activitiesByCity = {},
  restaurantsByCity = {},
  recommendations = [],
}) {
  const dep = departureTime instanceof Date ? departureTime : (departureTime ? new Date(departureTime) : new Date());
  const overnightStops = stops.filter(s => s.city);
  const dayCount = Math.max(1, overnightStops.length || 1);
  const roadByDay = distributeRoadStops(roadStops, overnightStops.length || 1);
  const days = [];

  if (overnightStops.length === 0) {
    const roadItems = [
      ...roadStops.map((rs, i) => mapRoadItem(rs, i)),
      ...optionalStopCards.slice(0, 3).map((p, i) => mapOptionalItem(p, i)),
    ];
    days.push({
      dayNumber: 1,
      label: "Day 1",
      date: formatDayDate(dep),
      drivingSummary: dayDrivingSummary(0, 1, routeInfo),
      roadStops: roadItems,
      overnight: null,
      activities: pickActivities(origin, activitiesByCity, restaurantsByCity, recommendations),
      overnightCity: null,
    });
    return days;
  }

  overnightStops.forEach((stop, dayIdx) => {
    const roadItems = (roadByDay[dayIdx] || []).map((rs, i) => mapRoadItem(rs, `${dayIdx}-${i}`));
    if (dayIdx === 0 && optionalStopCards.length) {
      optionalStopCards.slice(0, 2).forEach((p, i) => roadItems.push(mapOptionalItem(p, i)));
    }

    days.push({
      dayNumber: dayIdx + 1,
      label: `Day ${dayIdx + 1}`,
      date: formatDayDate(addDays(dep, dayIdx)),
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
        rating: parseRating(stop.rating),
        lat: stop.lat,
        lng: stop.lng,
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

export function getItineraryOverview({ origin, dest, routeInfo, stops, roadStops, budgetTotal }) {
  const miles = parseMilesFromDistance(routeInfo?.distance);
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const dayCount = Math.max(1, stops.filter(s => s.city).length || 1);
  return {
    origin: cityLabel(origin) || origin,
    destination: cityLabel(dest) || dest,
    tripName: `${cityLabel(origin) || origin} to ${cityLabel(dest) || dest}`,
    distance: routeInfo?.distance || (miles ? `${Math.round(miles)} mi` : "—"),
    duration: routeInfo?.duration || (hours ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m` : "—"),
    dayCount,
    stopCount: (roadStops?.length || 0) + stops.length,
    overnightCount: stops.filter(s => s.city).length,
    estimatedCost: budgetTotal,
  };
}
