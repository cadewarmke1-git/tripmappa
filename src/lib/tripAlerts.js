/** Compute automatic trip alerts from route, answers, and stop data. */
import {
  getFuelRangeMiles,
  needsElderlyOrPregnantRest,
  needsRefrigeratedMeds,
  needsDialysis,
  needsVetCare,
  getTripBudgetCap,
} from "./tripAccommodations.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { computeNightSegments } from "./tripMapSegments.js";

let alertCounter = 0;
function mkAlert(type, title, message, meta = {}) {
  alertCounter += 1;
  return { id: `alert-${type}-${alertCounter}`, type, title, message, ...meta };
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
  const alerts = [];
  const miles = parseMilesFromDistance(routeInfo?.distance);
  const hours = parseHoursFromDuration(routeInfo?.duration);
  const range = getFuelRangeMiles(answers);

  if (needsElderlyOrPregnantRest(answers)) {
    alerts.push(mkAlert("rest", "Rest breaks recommended", "Plan a stop every 90 minutes — no segment should exceed 90 minutes without a rest option.", { mapCategory: "alert" }));
  }

  if (departureTime && routeInfo?.routePoints?.length) {
    const nightSegs = computeNightSegments(routeInfo.routePoints, departureTime, hours);
    nightSegs.forEach((seg, i) => {
      alerts.push(mkAlert("night", "Night driving segment", `Segment ${i + 1} falls between 10 PM and 6 AM. Well-lit 24-hour stops recommended.`, {
        segmentIndex: seg.index,
        mapCategory: "alert",
        markerId: `night-seg-${i}`,
      }));
    });
  }

  if (fuelStopPoints.length >= 2) {
    for (let i = 1; i < fuelStopPoints.length; i++) {
      const gap = fuelStopPoints[i].segmentMiles ?? (miles ? miles / fuelStopPoints.length : null);
      if (gap != null && gap > range) {
        alerts.push(mkAlert("low_fuel", "Low fuel warning", `Gap of ~${Math.round(gap)} mi exceeds safe range (${range} mi). Urgent fuel stop needed.`, {
          segmentIndex: i,
          mapCategory: "alert",
          markerId: `low-fuel-${i}`,
        }));
      }
    }
  }

  if (needsRefrigeratedMeds(answers)) {
    stops.forEach(stop => {
      const services = nearbyServicesByCity[stop.city];
      const hasPharmacy = services?.pharmacy?.length || services?.hospital?.length;
      if (!hasPharmacy) {
        alerts.push(mkAlert("medical", "Medical services unavailable", `Limited pharmacy access near ${stop.city} for refrigerated medication.`, { city: stop.city, mapCategory: "medical" }));
      }
    });
  }

  if (needsDialysis(answers)) {
    alerts.push(mkAlert("medical", "Dialysis centers", "Dialysis centers listed in Nearby Services at each overnight stop.", { mapCategory: "medical" }));
  }

  if (needsVetCare(answers)) {
    alerts.push(mkAlert("vet", "Veterinary care", "Veterinary clinics listed in Nearby Services at each overnight stop.", { mapCategory: "vet" }));
  }

  const cap = getTripBudgetCap(answers);
  if (cap != null && budgetTotal != null && budgetTotal > cap) {
    alerts.push(mkAlert("budget", "Budget exceeded", `Estimated total $${Math.round(budgetTotal)} exceeds your $${cap} budget limit.`, { mapCategory: "budget" }));
  } else if (cap != null && budgetTotal != null && cap - budgetTotal <= 50) {
    alerts.push(mkAlert("budget", "Budget warning", `Within $50 of your $${cap} budget limit.`, { mapCategory: "budget" }));
  }

  return alerts;
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
