/** Flatten itinerary days into compact timeline rows for the results panel. */
import { parseHoursFromDuration } from "./parsing.js";

function cityLabel(full) {
  if (!full) return "Destination";
  return full.split(",")[0].trim();
}

function legDriveLabel(prevStop, nextStop, day) {
  const parts = [nextStop?.eta, nextStop?.distance].filter(Boolean);
  if (parts.length) return { duration: nextStop.eta, miles: nextStop.distance };
  if (nextStop?.distanceFromRoute != null) {
    const miles = typeof nextStop.distanceFromRoute === "number"
      ? `${nextStop.distanceFromRoute} mi`
      : String(nextStop.distanceFromRoute);
    return { duration: null, miles };
  }
  if (day?.drivingSummary) {
    return { duration: day.drivingSummary.duration, miles: day.drivingSummary.miles };
  }
  return { duration: null, miles: null };
}

function estimateArrival(departureTime, dayIdx, drivingSummary) {
  const base = departureTime instanceof Date ? new Date(departureTime) : new Date();
  const arrival = new Date(base);
  arrival.setDate(arrival.getDate() + dayIdx);
  const hours = parseHoursFromDuration(drivingSummary?.duration);
  if (hours) arrival.setMinutes(arrival.getMinutes() + Math.round(hours * 60));
  else arrival.setHours(18, 0, 0, 0);
  return arrival.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * @returns {Array<
 *   | { kind: "day-anchor", id: string, dayIndex: number, label: string }
 *   | { kind: "drive", id: string, duration: string|null, miles: string|null }
 *   | { kind: "stop", id: string, stop: object, isOvernight: boolean, dayIndex: number }
 *   | { kind: "destination", id: string, title: string, arrivalTime: string|null }
 * >}
 */
export function buildJourneyTimeline({
  days = [],
  dest,
  departureTime = null,
  continuousDrive = false,
}) {
  const rows = [];

  days.forEach((day, dayIdx) => {
    rows.push({
      kind: "day-anchor",
      id: `day-anchor-${day.dayNumber}`,
      dayIndex: dayIdx,
      label: day.label,
    });

    const ordered = [
      ...(day.roadStops || []).map(stop => ({ kind: "road", stop })),
      ...(!continuousDrive && day.overnight ? [{ kind: "overnight", stop: day.overnight }] : []),
    ];

    ordered.forEach((item, index) => {
      if (index > 0) {
        const drive = legDriveLabel(ordered[index - 1].stop, item.stop, day);
        rows.push({
          kind: "drive",
          id: `drive-${day.dayNumber}-${index}`,
          duration: drive.duration,
          miles: drive.miles,
        });
      }
      rows.push({
        kind: "stop",
        id: item.stop.id || `stop-${day.dayNumber}-${index}`,
        stop: item.stop,
        isOvernight: item.kind === "overnight",
        dayIndex: dayIdx,
      });
    });
  });

  const lastDay = days[days.length - 1];
  rows.push({
    kind: "destination",
    id: "destination",
    title: cityLabel(dest),
    arrivalTime: lastDay ? estimateArrival(departureTime, days.length - 1, lastDay.drivingSummary) : null,
  });

  return rows;
}

export function countTimelineStopRows(rows) {
  return rows.filter(r => r.kind === "stop" || r.kind === "destination").length;
}

function waypointToStop(w) {
  return {
    id: w.id,
    type: w.role === "overnight" ? "overnight" : "road",
    title: w.title,
    city: w.city,
    category: w.category,
    description: w.description,
    rating: w.rating,
    photoUrl: w.photoUrl,
    action: w.action,
    stopData: w.stopData,
    nearbyRestaurants: w.nearbyRestaurants,
    lat: w.lat,
    lng: w.lng,
  };
}
