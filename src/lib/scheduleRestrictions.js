/** Travel schedule restrictions — alerts and itinerary guidance without external APIs. */
import { asArray } from "./tripAccommodations.js";
import { parseHoursFromDuration } from "./parsing.js";

export const SCHEDULE_CHOICES = [
  "No restrictions",
  "Cannot travel on Saturdays — Sabbath observant",
  "Cannot travel on Sundays",
  "Drive only during specific hours — I will specify",
];

export const SCHEDULE_SABBATH = "Cannot travel on Saturdays — Sabbath observant";
export const SCHEDULE_SUNDAY = "Cannot travel on Sundays";
export const SCHEDULE_SPECIFIC_HOURS = "Drive only during specific hours — I will specify";

export function needsScheduleHoursDetail(answers) {
  return asArray(answers?.schedule_restrictions).includes(SCHEDULE_SPECIFIC_HOURS);
}

export function getScheduleRestrictionLabels(answers) {
  return asArray(answers?.schedule_restrictions).filter(s => s && s !== "No restrictions");
}

function dayName(date) {
  return date.toLocaleDateString(undefined, { weekday: "long" });
}

function overlapsRestrictedDay(departureTime, durationHours, restrictedDayName) {
  if (!departureTime || durationHours == null || durationHours <= 0) return false;
  const start = departureTime instanceof Date ? departureTime : new Date(departureTime);
  if (Number.isNaN(start.getTime())) return false;
  const endMs = start.getTime() + durationHours * 3600000;
  for (let t = start.getTime(); t <= endMs; t += 3600000) {
    if (dayName(new Date(t)) === restrictedDayName) return true;
  }
  return false;
}

export function buildScheduleAlerts({ answers, routeInfo, departureTime = null }) {
  const restrictions = getScheduleRestrictionLabels(answers);
  if (!restrictions.length) return [];

  const hours = parseHoursFromDuration(routeInfo?.duration);
  const dep = departureTime instanceof Date ? departureTime : (departureTime ? new Date(departureTime) : new Date());
  const alerts = [];

  if (restrictions.includes(SCHEDULE_SABBATH) && overlapsRestrictedDay(dep, hours, "Saturday")) {
    alerts.push({
      type: "schedule",
      title: "Saturday travel restriction",
      message: "Your trip may include driving on Saturday. Plan an overnight stop before Friday sunset or adjust departure so Sabbath observance is respected.",
      mapCategory: "alert",
    });
  }

  if (restrictions.includes(SCHEDULE_SUNDAY) && overlapsRestrictedDay(dep, hours, "Sunday")) {
    alerts.push({
      type: "schedule",
      title: "Sunday travel restriction",
      message: "This itinerary may include Sunday driving. Consider stopping the night before or shifting departure to avoid Sunday travel.",
      mapCategory: "alert",
    });
  }

  if (restrictions.includes(SCHEDULE_SPECIFIC_HOURS)) {
    const window = answers?.schedule_drive_hours?.trim();
    alerts.push({
      type: "schedule",
      title: "Driving hours preference",
      message: window
        ? `You prefer to drive only during: ${window}. Verify each day's segments fit your window before you leave.`
        : "You asked to drive only during specific hours — add your preferred window in Edit plan if you haven't already.",
      mapCategory: "alert",
    });
  }

  return alerts;
}

/** Short hint for a driving day label when schedule restrictions apply. */
export function scheduleHintForDay(answers, departureTime, dayIndex) {
  const restrictions = getScheduleRestrictionLabels(answers);
  if (!restrictions.length || dayIndex == null || dayIndex < 0) return null;
  const dep = departureTime instanceof Date ? departureTime : (departureTime ? new Date(departureTime) : new Date());
  if (Number.isNaN(dep.getTime())) return null;
  const dayDate = new Date(dep);
  dayDate.setDate(dayDate.getDate() + dayIndex);
  const weekday = dayDate.toLocaleDateString(undefined, { weekday: "long" });

  if (restrictions.some(r => /Saturday|Sabbath/i.test(r)) && weekday === "Saturday") {
    return "Sabbath — no driving planned this day";
  }
  if (restrictions.some(r => /Sunday/i.test(r)) && weekday === "Sunday") {
    return "Sunday — no driving planned this day";
  }
  if (restrictions.some(r => /specific hours/i.test(r)) && answers.schedule_drive_hours?.trim()) {
    return `Drive window: ${answers.schedule_drive_hours.trim()}`;
  }
  return null;
}
