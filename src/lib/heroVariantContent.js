/** Copy and metrics for results hero variants. */
import { computeHOSCompliance } from "./hos.js";
import { parseHoursFromDuration } from "./parsing.js";
import { countTimelineStops } from "./itineraryDays.js";
import { countIncludedStops } from "./itineraryWaypoints.js";

function cityLabel(full) {
  if (!full) return "Destination";
  return full.split(",")[0].trim();
}

export function formatHosSummaryLine(hosCompliance, routeInfo) {
  if (typeof hosCompliance === "string" && hosCompliance.trim()) {
    const line = hosCompliance.trim().split(/\n/)[0];
    return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  }
  if (hosCompliance && typeof hosCompliance === "object" && hosCompliance.drivingDays) {
    const days = hosCompliance.drivingDays;
    const nights = hosCompliance.overnightStopsRequired ?? 0;
    return `${days} driving day${days !== 1 ? "s" : ""} · ${nights} overnight stop${nights !== 1 ? "s" : ""} required`;
  }
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const computed = hours ? computeHOSCompliance(hours) : null;
  if (!computed) return "HOS-compliant route";
  return `${computed.drivingDays} driving day${computed.drivingDays !== 1 ? "s" : ""} · ${computed.mandatoryBreaks} break${computed.mandatoryBreaks !== 1 ? "s" : ""} · ${computed.overnightStopsRequired} overnight`;
}

export function countFuelAndWeighStops(roadStops = []) {
  let fuel = 0;
  let weigh = 0;
  for (const rs of roadStops) {
    const cat = String(rs.category || "").toLowerCase();
    const name = String(rs.name || rs.location || "").toLowerCase();
    if (/weigh|scale|inspection/i.test(cat) || /weigh|scale station/i.test(name)) {
      weigh += 1;
    } else if (/fuel|diesel|gas|ev|charge/i.test(cat) || /pilot|love'?s|flying j|\bta\b|shell|chevron/i.test(name)) {
      fuel += 1;
    }
  }
  return { fuel, weigh, total: fuel + weigh };
}

export function collectRouteHighlights({ days = [], roadStops = [], recommendations = [] }) {
  const out = [];
  const push = (label) => {
    const t = String(label || "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const rs of roadStops) {
    const cat = String(rs.category || "").toLowerCase();
    if (/scenic|discovery|view|overlook|attraction/i.test(cat) || rs.scenicView) {
      push(rs.name || rs.location);
    }
  }
  for (const day of days) {
    for (const stop of day.roadStops || []) {
      if (/discovery|scenic/i.test(stop.category || "")) push(stop.title);
      if (stop.stopData?.scenicView) push(stop.stopData.scenicView);
    }
  }
  for (const rec of recommendations) push(rec.name);
  return out.slice(0, 6);
}

export function buildMultiDayChips(days, dest) {
  const chips = days.map((day, i) => {
    const city = day.overnightCity ? cityLabel(day.overnightCity) : cityLabel(dest);
    const isLast = i === days.length - 1;
    if (isLast && dest) {
      return { dayIndex: i, label: `Day ${day.dayNumber}`, sub: `Arrive ${cityLabel(dest)}` };
    }
    return { dayIndex: i, label: `Day ${day.dayNumber}`, sub: city };
  });
  if (chips.length && dest) {
    const last = chips[chips.length - 1];
    last.sub = `Arrive ${cityLabel(dest)}`;
  }
  return chips;
}

export function resolveHeroStopCount({ waypoints, stops, roadStops }) {
  if (waypoints?.length) return countIncludedStops(waypoints);
  return countTimelineStops({ stops, roadStops });
}

export function dayTripHeroStats({ routeInfo, stops, roadStops, days, recommendations, waypoints }) {
  const stopCount = resolveHeroStopCount({ waypoints, stops, roadStops });
  const duration = routeInfo?.duration || "—";
  const highlights = collectRouteHighlights({ days, roadStops, recommendations });
  return {
    stopCount,
    duration,
    firstHighlight: highlights[0] || null,
  };
}
