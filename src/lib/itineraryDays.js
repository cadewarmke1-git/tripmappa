/** Build day-by-day itinerary structure from trip stops. */
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";

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

export function buildItineraryDays({
  origin,
  dest,
  stops = [],
  roadStops = [],
  routeInfo,
  departureTime = null,
  optionalStopCards = [],
}) {
  const dep = departureTime instanceof Date ? departureTime : (departureTime ? new Date(departureTime) : new Date());
  const overnightStops = stops.filter(s => s.city);
  const dayCount = Math.max(1, overnightStops.length || 1);
  const roadByDay = distributeRoadStops(roadStops, overnightStops.length || 1);
  const days = [];

  if (overnightStops.length === 0) {
    const items = [
      {
        id: "departure",
        type: "departure",
        title: cityLabel(origin) || "Departure",
        city: origin,
        description: "Start your adventure — the open road awaits.",
        eta: routeInfo?.duration ? `Total ${routeInfo.duration}` : null,
        distance: null,
        action: "directions",
      },
      ...roadStops.map((rs, i) => mapRoadItem(rs, i)),
      ...optionalStopCards.slice(0, 3).map((p, i) => mapOptionalItem(p, i)),
      {
        id: "arrival",
        type: "arrival",
        title: cityLabel(dest) || "Destination",
        city: dest,
        description: "You've arrived — enjoy your destination!",
        eta: null,
        distance: routeInfo?.distance,
        action: "directions",
      },
    ];
    days.push({
      dayNumber: 1,
      label: "Day 1",
      date: formatDayDate(dep),
      items,
      overnightCity: null,
    });
    return days;
  }

  overnightStops.forEach((stop, dayIdx) => {
    const dayNum = dayIdx + 1;
    const items = [];

    if (dayIdx === 0) {
      items.push({
        id: "departure",
        type: "departure",
        title: cityLabel(origin) || "Departure",
        city: origin,
        description: "Begin your journey from here.",
        eta: stop.eta ? `Arrive ${stop.city} · ${stop.eta}` : null,
        distance: stop.distance,
        action: "directions",
      });
    }

    (roadByDay[dayIdx] || []).forEach((rs, i) => items.push(mapRoadItem(rs, `${dayIdx}-${i}`)));

    if (dayIdx === 0 && optionalStopCards.length) {
      optionalStopCards.slice(0, 2).forEach((p, i) => items.push(mapOptionalItem(p, i)));
    }

    items.push({
      id: `overnight-${dayIdx}`,
      type: "overnight",
      title: cityLabel(stop.city),
      city: stop.city,
      description: stop.why || "Your home base for the night — rest up for tomorrow's drive.",
      eta: stop.eta,
      distance: stop.distance,
      rating: stop.rating,
      lat: stop.lat,
      lng: stop.lng,
      stopData: stop,
      action: "book",
    });

    if (dayIdx === overnightStops.length - 1) {
      items.push({
        id: "arrival",
        type: "arrival",
        title: cityLabel(dest) || "Destination",
        city: dest,
        description: "Final leg — your destination is within reach.",
        eta: null,
        distance: routeInfo?.distance,
        action: "directions",
      });
    }

    days.push({
      dayNumber: dayNum,
      label: `Day ${dayNum}`,
      date: formatDayDate(addDays(dep, dayIdx)),
      items,
      overnightCity: stop.city,
      stopIndex: dayIdx,
    });
  });

  return days;
}

function mapRoadItem(rs, key) {
  const rating = rs.rating ?? parseFloat(String(rs.note || "").match(/(\d+\.?\d*)\s*star/i)?.[1]);
  return {
    id: rs.id || `road-${key}`,
    type: "road",
    title: rs.name || rs.location || "Road stop",
    city: rs.location,
    description: rs.note || rs.amenities || "A worthwhile detour worth your time.",
    eta: rs.eta,
    distance: rs.distance,
    rating,
    photoUrl: rs.photoUrl,
    lat: rs.lat,
    lng: rs.lng,
    detourMiles: rs.detourMiles,
    localFavorite: rating >= 4.5,
    action: "add",
    stopData: rs,
  };
}

function mapOptionalItem(p, i) {
  return {
    id: p.id || `opt-${i}`,
    type: "discovery",
    title: p.name,
    city: p.address,
    description: "A fun stretch break along your route.",
    distance: p.distanceMiles != null ? `${p.distanceMiles} mi off route` : null,
    photoUrl: p.photoUrl,
    lat: p.lat,
    lng: p.lng,
    localFavorite: (p.rating ?? 0) >= 4.5,
    action: "add",
  };
}

export function getItineraryOverview({ origin, dest, routeInfo, stops, budgetTotal }) {
  const miles = parseMilesFromDistance(routeInfo?.distance);
  const hours = parseHoursFromDuration(routeInfo?.duration);
  return {
    origin: cityLabel(origin) || origin,
    destination: cityLabel(dest) || dest,
    distance: routeInfo?.distance || (miles ? `${Math.round(miles)} mi` : "—"),
    duration: routeInfo?.duration || (hours ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m` : "—"),
    overnightCount: stops.length,
    estimatedCost: budgetTotal,
  };
}
