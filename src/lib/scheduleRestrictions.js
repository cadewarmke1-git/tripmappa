import { asArray } from "./tripAccommodations.js";
import { parseHoursFromDuration } from "./parsing.js";
import { getEffectiveVehicle, isTruckVehicle, isWaterVehicle } from "./vehicles.js";

export const SCHEDULE_CHOICES = [
  "No restrictions",
  "Cannot travel on Saturdays — Sabbath observant",
  "Cannot travel on Sundays",
  "Drive only during specific hours — I will specify",
];

/** Alias for preferences UI and API documentation. */
export const SCHEDULE_RESTRICTION_CHOICES = SCHEDULE_CHOICES;

export const SCHEDULE_NO_RESTRICTIONS = "No restrictions";

export const SCHEDULE_SABBATH = "Cannot travel on Saturdays — Sabbath observant";
export const SCHEDULE_SUNDAY = "Cannot travel on Sundays";
export const SCHEDULE_SPECIFIC_HOURS = "Drive only during specific hours — I will specify";
export const SCHEDULE_TRAVEL_SPECIFIC_HOURS = "Travel only during specific hours — I will specify";

export const SCHEDULE_SPECIFIC_HOURS_VALUES = [
  SCHEDULE_SPECIFIC_HOURS,
  SCHEDULE_TRAVEL_SPECIFIC_HOURS,
];

/** Schedule multiselect choices with transport-appropriate labels (values unchanged). */
export function getScheduleChoicesForContext(answers = {}) {
  const effective = getEffectiveVehicle(answers);
  const isTravelMode = effective === "Plane" || effective === "Ferry" || isWaterVehicle(effective);
  const isTruck = isTruckVehicle(effective);

  return SCHEDULE_CHOICES.map((choice) => {
    if (choice !== SCHEDULE_SPECIFIC_HOURS) return choice;
    if (isTravelMode) {
      return {
        value: SCHEDULE_TRAVEL_SPECIFIC_HOURS,
        label: SCHEDULE_TRAVEL_SPECIFIC_HOURS,
      };
    }
    if (isTruck) {
      return {
        value: SCHEDULE_SPECIFIC_HOURS,
        label: "On the road only during specific hours — I will specify",
      };
    }
    return choice;
  });
}

export function needsScheduleHoursDetail(answers) {
  return asArray(answers?.schedule_restrictions).some(s => SCHEDULE_SPECIFIC_HOURS_VALUES.includes(s));
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

  if (restrictions.some(s => SCHEDULE_SPECIFIC_HOURS_VALUES.includes(s))) {
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
