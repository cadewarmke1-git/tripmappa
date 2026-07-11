/** Map marker categories, colors, and legend labels. */
import { getEffectiveVehicle, isRvVehicle } from "./vehicles.js";
import { buildNeonSignPinIcon } from "./mapNeonPinIcons.js";

const ICON_PATHS = {
  hotel: '<path d="M7 22V13a2 2 0 012-2h10a2 2 0 012 2v9M7 17h14M10 22v-3M18 22v-3" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  rv: '<path d="M16 7L8 21h16L16 7z" stroke="#fff" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="M16 13v5M13 18h6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  fuel: '<path d="M10 22V9l3-2 3 2v13M12 18h2M15 18h2M13 7V5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="11.5" y="11" width="3" height="4.5" rx="0.5" fill="#fff"/>',
  restaurant: '<path d="M9 22V11c0-2 .8-3.5 3-3.5s3 1.5 3 3.5v11M15 22V9c0-2 .8-3.5 3-3.5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M7 22V15" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>',
  rest: '<path d="M10 22V14c0-2 1.5-3.5 3-3.5h2c1.5 0 3 1.5 3 3.5v8" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M8 10h8l-1-4H9l-1 4z" stroke="#fff" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M7 22h10" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
  ev: '<path d="M13 4l-4 8h3l-2 8 6-10h-3l2-6z" fill="#fff" stroke="#fff" stroke-width="0.5" stroke-linejoin="round"/>',
  truck: '<path d="M4 18h1M19 18h1M6 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0M16 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0M4 14h11v4H4v-4zM15 14h3l2 3v1h-5v-4z" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  park: '<path d="M16 22V12l-4-6-4 6v10" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14c2-3 4-3 6 0 2-3 4-3 6 0" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  poi: '<path d="M16 10l-2.5 5 2.5 5 2.5-5-2.5-5z" fill="#fff"/><circle cx="16" cy="16" r="9" stroke="#fff" stroke-width="1.4" fill="none"/>',
  medical: '<path d="M16 8v16M8 16h16" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
  vet: '<ellipse cx="16" cy="19" rx="5" ry="4" fill="#fff"/><circle cx="12" cy="12" r="2" fill="#fff"/><circle cx="20" cy="12" r="2" fill="#fff"/><circle cx="16" cy="9" r="2" fill="#fff"/>',
  playground: '<path d="M10 24V14l6-6 6 6v10M13 24v-6h6v6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  entertainment: '<path d="M12 22V12M12 12c0-3 2-5 4-5s4 2 4 5M20 22V12M20 12c0-3 2-5 4-5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="12" cy="9" r="2" fill="#fff"/><circle cx="20" cy="9" r="2" fill="#fff"/>',
  wifi: '<path d="M8 18c4-4 12-4 16 0M11 21c2.5-2.5 7.5-2.5 10 0M14 24h4" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="16" cy="24" r="1.5" fill="#fff"/>',
  religious: '<path d="M16 6v20M10 12h12M13 12V9a3 3 0 016 0v3" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  safety: '<path d="M16 5l9 4v7c0 6-4 10-9 12-5-2-9-6-9-12V9l9-4z" stroke="#fff" stroke-width="1.8" fill="none"/>',
  budget: '<text x="16" y="21" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">$</text>',
  alert: '<text x="16" y="21" text-anchor="middle" font-size="15" font-weight="800" fill="#fff">!</text>',
  custom: '<circle cx="16" cy="16" r="4" fill="#fff"/>',
  repair: '<path d="M14 10l-4 4 6 6 4-4-6-6zM11 13l-2 2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  default: '<circle cx="16" cy="16" r="3" fill="#fff"/>',
};

function mapRoadStopCategory(rs) {
  if (rs.safetyFlagged) return "safety";
  const c = rs.category;
  if (c === "food") return "restaurant";
  if (c === "fuel") return "fuel";
  if (c === "charging") return "ev";
  if (c === "rest") return "rest";
  if (c === "truck") return "truck";
  if (c === "park" || c === "discovery") return "park";
  if (c === "medical") return "medical";
  if (rs.wifiAvailable) return "wifi";
  return "poi";
}

export function buildMarkerIcon(category, isDarkMode = false, { pinNumber = null, pinSize = "normal" } = {}) {
  void isDarkMode;
  return buildNeonSignPinIcon(category, { pinNumber, pinSize });
}

function mapWaypointCategory(w, answers) {
  if (w.role === "overnight") {
    return answers && isRvVehicle(getEffectiveVehicle(answers)) ? "rv" : "hotel";
  }
  const cat = String(w.category || "").toLowerCase();
  if (/fuel|diesel|gas/i.test(cat)) return "fuel";
  if (/food|rest/i.test(cat)) return "restaurant";
  if (/scenic|discovery|park/i.test(cat)) return "park";
  return "poi";
}

/** Numbered pins synced to itinerary waypoint order. */
export function waypointsToNumberedMarkers(waypoints = [], answers = null) {
  const markers = [];
  let num = 0;
  for (const w of waypoints) {
    if (w.kind === "origin") continue;
    if (w.kind === "stop" && !w.included) continue;
    if (w.lat == null || w.lng == null) continue;

    if (w.kind === "destination") {
      markers.push({
        id: w.id,
        waypointId: w.id,
        lat: w.lat,
        lng: w.lng,
        category: "destination",
        pinSize: "large",
        title: w.title,
        subtitle: "Destination",
        zIndex: 20,
      });
      continue;
    }

    num += 1;
    const stopData = w.stopData || {};
    markers.push({
      id: w.id,
      waypointId: w.id,
      lat: w.lat,
      lng: w.lng,
      category: mapWaypointCategory(w, answers),
      pinNumber: num,
      title: w.title,
      subtitle: w.city || "",
      zIndex: 10 + num,
      action: w.action || "navigate",
      website: w.website || stopData.website || stopData.websiteUri,
      bookUrl: w.bookUrl || stopData.bookUrl,
      menuUrl: w.menuUrl || stopData.menuUrl || stopData.menu,
      rating: stopData.rating ?? w.rating,
      stopData,
    });
  }
  return markers;
}

export function stopsToMapMarkers(stops = [], roadStops = [], customStops = [], extraMarkers = [], answers = null) {
  const markers = [];
  const overnightCategory = answers && isRvVehicle(getEffectiveVehicle(answers)) ? "rv" : "hotel";

  stops.forEach((stop, i) => {
    if (stop.lat != null && stop.lng != null) {
      markers.push({
        id: `stop-${i}`,
        lat: stop.lat,
        lng: stop.lng,
        category: stop.safetyFlagged ? "safety" : overnightCategory,
        title: stop.city || stop.name,
        subtitle: `${stop.distance || ""} · ${stop.eta || ""}`.trim(),
        stopIndex: i,
        action: "book",
        bookUrl: stop.bookUrl,
        website: stop.website || stop.bookUrl,
        menuUrl: stop.menuUrl,
      });
    }
  });

  roadStops.forEach((rs, i) => {
    if (rs.lat != null && rs.lng != null) {
      markers.push({
        id: rs.id || `road-${i}`,
        lat: rs.lat,
        lng: rs.lng,
        category: mapRoadStopCategory(rs),
        title: rs.name || rs.title,
        subtitle: rs.location || rs.distance,
        action: "add",
        website: rs.website || rs.websiteUri || rs.url,
        menuUrl: rs.menuUrl || rs.menu,
      });
    }
  });

  customStops.forEach(cs => {
    markers.push({ ...cs, category: cs.category || "custom", action: "directions" });
  });

  extraMarkers.forEach(a => markers.push(a));

  return markers;
}
