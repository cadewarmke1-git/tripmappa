/** Dinner-time restaurant open/closed logic using Places hours signals. */

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseTimeLabel(text) {
  if (!text || typeof text !== "string") return null;
  const m = text.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const pm = /pm/i.test(m[3]);
  if (pm && h < 12) h += 12;
  if (!pm && h === 12) h = 0;
  return { h, min, label: text.trim() };
}

function opensTodayFromWeekdayText(hoursText, arrival = new Date()) {
  if (!hoursText) return null;
  const dayName = DAY_NAMES[arrival.getDay()];
  const chunk = hoursText.split(";").find(line => line.toLowerCase().startsWith(dayName));
  if (!chunk) return null;
  if (/closed/i.test(chunk)) return null;
  const openPart = chunk.split(":").slice(1).join(":").trim();
  const openMatch = openPart.match(/([\d:]+\s*[AP]M)/i);
  return openMatch ? parseTimeLabel(openMatch[1]) : null;
}

function opensBeforeArrival(openTime, arrival) {
  if (!openTime) return false;
  const openMins = openTime.h * 60 + openTime.min;
  const arrMins = arrival.getHours() * 60 + arrival.getMinutes();
  return openMins <= arrMins + 30;
}

function opensWithinMinutes(openTime, arrival, withinMinutes = 120) {
  if (!openTime) return false;
  const nowMins = arrival.getHours() * 60 + arrival.getMinutes();
  const openMins = openTime.h * 60 + openTime.min;
  const diff = openMins - nowMins;
  return diff >= 0 && diff <= withinMinutes;
}

export function isOpenOrOpeningWithinTwoHours(restaurant, arrival = new Date()) {
  const openNow = restaurant.currentlyOpen ?? restaurant.openNow;
  if (openNow === true) return true;
  const opensAt = opensTodayFromWeekdayText(restaurant.hours, arrival);
  if (openNow === false && opensAt) {
    return opensWithinMinutes(opensAt, arrival, 120);
  }
  return false;
}

export function dinnerOpenStatus(restaurant, arrival = new Date()) {
  const openNow = restaurant.currentlyOpen ?? restaurant.openNow;
  if (openNow === true) {
    return { kind: "open", label: "Open", className: "open" };
  }

  const opensAt = opensTodayFromWeekdayText(restaurant.hours, arrival);
  if (openNow === false && opensAt && opensBeforeArrival(opensAt, arrival)) {
    return { kind: "opens_later", label: `Opens ${opensAt.label}`, className: "opens-later" };
  }

  if (openNow === false) {
    if (opensAt) {
      return { kind: "opens_later", label: `Opens ${opensAt.label}`, className: "opens-later" };
    }
    return { kind: "closed", label: "Closed", className: "closed" };
  }

  return { kind: "unknown", label: "Hours vary", className: "unknown" };
}

export function isEligibleDinnerPick(restaurant, arrival = new Date()) {
  const status = dinnerOpenStatus(restaurant, arrival);
  return status.kind === "open" || status.kind === "opens_later" || status.kind === "unknown";
}

export function sortRestaurantsForDinner(restaurants = [], arrival = new Date()) {
  const rank = (r) => {
    const s = dinnerOpenStatus(r, arrival);
    if (s.kind === "open") return 0;
    if (s.kind === "opens_later") return 1;
    if (s.kind === "unknown") return 2;
    return 3;
  };
  return [...restaurants].sort((a, b) => rank(a) - rank(b) || (b.rating ?? 0) - (a.rating ?? 0));
}

export function filterDinnerRestaurants(restaurants = [], arrival = new Date()) {
  const sorted = sortRestaurantsForDinner(restaurants, arrival);
  const eligible = sorted.filter(r => isEligibleDinnerPick(r, arrival));
  if (eligible.length >= 2) return eligible;
  return sorted.filter(r => dinnerOpenStatus(r, arrival).kind !== "closed");
}
