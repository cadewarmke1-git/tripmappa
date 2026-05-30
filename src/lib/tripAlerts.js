/** Compute automatic trip alerts — consolidated, capped, actionable. */
import {
  getFuelRangeMiles,
  needsElderlyRest,
  needsYoungChildrenRest,
  getTripBudgetCap,
  needsRefrigeratedMedStops,
  needsDialysisServices,
  needsVetServices,
} from "./tripAccommodations.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { computeNightDrivingBlocks } from "./tripMapSegments.js";
import { buildScheduleAlerts } from "./scheduleRestrictions.js";

const MAX_ALERTS = 6;
const ALERT_PRIORITY = ["budget", "schedule", "low_fuel", "night", "rest", "medical", "vet", "alert"];

function mkAlert(type, title, message, meta = {}) {
  return { id: `alert-${type}-${meta.key || type}`, type, title, message, ...meta };
}

function formatNightBlockMessage(block, departureTime) {
  const start = new Date(departureTime.getTime() + block.startHour * 3600000);
  const end = new Date(departureTime.getTime() + block.endHour * 3600000);
  const fmt = d => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const hrs = Math.round((block.endHour - block.startHour) * 10) / 10;
  return `About ${hrs}h of driving between ${fmt(start)} and ${fmt(end)}. Well-lit, 24-hour stops recommended.`;
}

export function consolidateAndCapAlerts(alerts, max = MAX_ALERTS) {
  const byType = new Map();
  for (const a of alerts) {
    const existing = byType.get(a.type);
    if (!existing) {
      byType.set(a.type, { ...a });
      continue;
    }
    if (a.type === "night") {
      byType.set(a.type, {
        ...existing,
        message: existing.message.includes(a.message) ? existing.message : `${existing.message} Also: ${a.message}`,
      });
      continue;
    }
    if (a.type === "medical" && a.message !== existing.message) {
      byType.set(a.type, {
        ...existing,
        message: `${existing.message} Also: ${a.message}`,
      });
    }
  }
  return [...byType.values()]
    .sort((a, b) => {
      const pa = ALERT_PRIORITY.indexOf(a.type);
      const pb = ALERT_PRIORITY.indexOf(b.type);
      return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    })
    .slice(0, max);
}

export function computeTripAlerts({
  answers,
  routeInfo,
  stops = [],
  roadStops = [],
  fuelStopPoints = [],
  nearbyServicesByCity = {},
  budgetTotal = null,
  departureTime = null,
}) {
  const raw = [];
  const miles = parseMilesFromDistance(routeInfo?.distance);
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const range = getFuelRangeMiles(answers);

  if (needsElderlyRest(answers) || needsYoungChildrenRest(answers)) {
    raw.push(mkAlert("rest", "Rest breaks recommended", "Plan a stop about every 90 minutes for comfort and safety.", { mapCategory: "alert" }));
  }

  if (departureTime && hours) {
    const nightBlocks = computeNightDrivingBlocks(departureTime, hours, routeInfo?.routePoints);
    nightBlocks.forEach((block, i) => {
      const midFrac = ((block.startHour + block.endHour) / 2) / hours;
      const ptIdx = Math.floor(midFrac * Math.max(0, (routeInfo?.routePoints?.length || 1) - 1));
      const pt = routeInfo?.routePoints?.[ptIdx];
      raw.push(mkAlert(
        "night",
        "Night driving",
        `You'll be on the road between 10 PM and 6 AM. ${formatNightBlockMessage(block, departureTime instanceof Date ? departureTime : new Date(departureTime))}`,
        {
          mapCategory: "alert",
          markerId: `night-block-${i}`,
          lat: pt?.lat,
          lng: pt?.lng,
          key: `night-${i}`,
        },
      ));
    });
  }

  if (fuelStopPoints.length >= 2) {
    let worstGap = 0;
    let worstIdx = 0;
    for (let i = 1; i < fuelStopPoints.length; i++) {
      const gap = fuelStopPoints[i].segmentMiles ?? (miles ? miles / fuelStopPoints.length : null);
      if (gap != null && gap > worstGap) { worstGap = gap; worstIdx = i; }
    }
    if (worstGap > range) {
      raw.push(mkAlert("low_fuel", "Fuel range warning", `Longest gap (~${Math.round(worstGap)} mi) exceeds safe range (${range} mi). Plan an extra fuel stop.`, {
        segmentIndex: worstIdx,
        mapCategory: "alert",
        markerId: "low-fuel-worst",
      }));
    }
  }

  const cap = getTripBudgetCap(answers);
  if (cap != null && budgetTotal != null && budgetTotal > cap) {
    raw.push(mkAlert("budget", "Over budget", `Estimated $${Math.round(budgetTotal)} exceeds your $${cap} limit.`, { mapCategory: "budget" }));
  } else if (cap != null && budgetTotal != null && cap - budgetTotal <= 50) {
    raw.push(mkAlert("budget", "Near budget limit", `About $${Math.round(cap - budgetTotal)} remaining in your $${cap} budget.`, { mapCategory: "budget" }));
  }

  raw.push(...buildScheduleAlerts({ answers, routeInfo, departureTime }));

  if (needsRefrigeratedMedStops(answers) && stops.length) {
    const missingPharmacy = stops.filter((stop) => {
      const services = nearbyServicesByCity[stop.city] || {};
      const pharmacies = services.pharmacy || [];
      return !pharmacies.length;
    });
    if (missingPharmacy.length) {
      const cities = missingPharmacy.map(s => s.city).filter(Boolean).slice(0, 3).join(", ");
      raw.push(mkAlert(
        "medical",
        "Pharmacy access needed",
        cities
          ? `Some overnight stops (${cities}) may lack nearby pharmacies for refrigerated medication. Plan backup cooling or an alternate stop.`
          : "Verify pharmacy access at each overnight stop for refrigerated medication.",
        { mapCategory: "medical" },
      ));
    }
  }

  if (needsDialysisServices(answers) && stops.length) {
    const missingDialysis = stops.filter((stop) => {
      const services = nearbyServicesByCity[stop.city] || {};
      return !(services.dialysis || []).length;
    });
    if (missingDialysis.length === stops.length) {
      raw.push(mkAlert(
        "medical",
        "Dialysis centers",
        "No dialysis centers were found near your overnight stops. Confirm treatment locations before you travel.",
        { mapCategory: "medical" },
      ));
    }
  }

  if (needsVetServices(answers) && stops.length) {
    const missingVet = stops.filter((stop) => {
      const services = nearbyServicesByCity[stop.city] || {};
      return !(services.vet || []).length;
    });
    if (missingVet.length === stops.length) {
      raw.push(mkAlert(
        "vet",
        "Veterinary care",
        "No veterinary clinics were found near your overnight stops. Locate emergency animal care along your route.",
        { mapCategory: "vet" },
      ));
    }
  }

  return consolidateAndCapAlerts(raw);
}

export function alertsToMapMarkers(alerts, dismissedIds = []) {
  return alerts
    .filter(a => !dismissedIds.includes(a.id))
    .filter(a => a.lat != null && a.lng != null)
    .map(a => ({
      id: a.markerId || a.id,
      lat: a.lat,
      lng: a.lng,
      category: a.mapCategory || "alert",
      title: a.title,
      subtitle: a.message,
      alertId: a.id,
    }));
}
