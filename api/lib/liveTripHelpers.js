/** Shared helpers for live trip serverless routes. */

export const CONVOY_COLORS = ["#4A90D9", "#48B87A", "#9B72CF", "#FF7F6B", "#2EC4B6"];
export const BREADCRUMB_MAX = 500;
export const ARRIVAL_MILES = 1;
export const ARRIVAL_METERS = ARRIVAL_MILES * 1609.344;

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function appendBreadcrumb(existing, lat, lng) {
  const crumbs = Array.isArray(existing) ? [...existing] : [];
  const last = crumbs[crumbs.length - 1];
  if (last && last.lat === lat && last.lng === lng) return crumbs;
  crumbs.push({ lat, lng, t: new Date().toISOString() });
  return crumbs.length > BREADCRUMB_MAX ? crumbs.slice(-BREADCRUMB_MAX) : crumbs;
}

export function sumBreadcrumbMiles(crumbs) {
  if (!Array.isArray(crumbs) || crumbs.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < crumbs.length; i += 1) {
    total += haversineMiles(crumbs[i - 1].lat, crumbs[i - 1].lng, crumbs[i].lat, crumbs[i].lng);
  }
  return Math.round(total * 10) / 10;
}

export function getNextOvernightStop(stops) {
  if (!Array.isArray(stops)) return null;
  return stops.find(s => s?.city) || null;
}

export function assignConvoyColor(existingMembers) {
  const used = new Set((existingMembers || []).map(m => m.color));
  return CONVOY_COLORS.find(c => !used.has(c)) || CONVOY_COLORS[(existingMembers || []).length % CONVOY_COLORS.length];
}

export function mphFromSpeedMps(speedMps) {
  if (speedMps == null || !Number.isFinite(speedMps)) return null;
  return Math.round(speedMps * 2.23694);
}

export function extractDestinationCity(destination) {
  if (!destination) return "your destination";
  const parts = destination.split(",");
  return parts[0]?.trim() || destination;
}

export function checkEtaNotifications({
  nextStopEta,
  nextStopName,
  travelerName,
  sent,
  followerPhones,
}) {
  const updates = { ...(sent || {}) };
  let lastNotification = null;
  const notifications = [];

  if (!nextStopEta?.durationSeconds || !nextStopName) {
    return { eta_notifications_sent: updates, last_notification: null, notifications };
  }

  const secs = nextStopEta.durationSeconds;
  const stopCity = nextStopName.split(",")[0]?.trim() || nextStopName;
  const name = travelerName || "Traveler";

  if (secs <= 3600 && !updates["60"]) {
    updates["60"] = true;
    const msg = `${name} is 60 minutes from ${stopCity}.`;
    lastNotification = { minutes: 60, message: msg, at: new Date().toISOString() };
    notifications.push({ minutes: 60, message: msg, sms: false });
  }

  if (secs <= 1800 && !updates["30"]) {
    updates["30"] = true;
    const msg = `${name} is 30 minutes from ${stopCity}.`;
    lastNotification = { minutes: 30, message: msg, at: new Date().toISOString() };
    notifications.push({ minutes: 30, message: msg, sms: true, followerPhones: followerPhones || [] });
  }

  return { eta_notifications_sent: updates, last_notification: lastNotification, notifications };
}

export function checkArrival({ destEta, arrivedAt, now = new Date() }) {
  const distanceM = destEta?.distanceMeters;
  const arrived = distanceM != null && distanceM <= ARRIVAL_METERS;
  const arrivedAtIso = arrivedAt || (arrived ? now.toISOString() : null);
  let deactivate = false;
  if (arrivedAtIso) {
    const elapsed = now.getTime() - new Date(arrivedAtIso).getTime();
    if (elapsed >= 5 * 60 * 1000) deactivate = true;
  }
  return { arrived, arrivedAt: arrivedAtIso, deactivate };
}

export function googleMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
