/** Continuous vs overnight drive mode helpers. */
import { parseHoursFromDuration, parseMilesFromDistance } from "./parsing.js";

export const OVERNIGHT_PREFERENCE_OVERNIGHT = "Stop overnight along the way";
export const OVERNIGHT_PREFERENCE_CONTINUOUS = "Drive straight through";

const DAY_TRIP_MILES = 150;

function getRouteDistanceMiles(context) {
  if (context?.routeDistanceMiles != null) return context.routeDistanceMiles;
  return parseMilesFromDistance(context?.routeDistance);
}

function isDayTripByDistance(context) {
  const miles = getRouteDistanceMiles(context);
  return miles != null && miles < DAY_TRIP_MILES;
}

export function isContinuousDrive(answers) {
  if (!answers) return false;
  if (answers.continuous_drive === true) return true;
  return answers.overnight_preference === OVERNIGHT_PREFERENCE_CONTINUOUS;
}

export function getRouteDurationHours(context) {
  if (context?.routeDurationHours != null) return context.routeDurationHours;
  return parseHoursFromDuration(context?.routeDuration);
}

/** True when route distance/duration implies more than a single-day drive. */
export function requiresMultipleDays(context) {
  if (isDayTripByDistance(context)) return false;
  const hours = getRouteDurationHours(context);
  if (hours != null && hours > 11) return true;
  const miles = getRouteDistanceMiles(context);
  if (miles == null || miles < 150) return false;
  if (hours != null && hours > 6) return true;
  return hours == null;
}

export function buildContinuousDriveTip(routeInfo) {
  const duration = routeInfo?.duration;
  if (!duration) {
    return "Continuous drive mode — plan fuel and rest breaks along your route before you go.";
  }
  return `Continuous drive mode — total estimated drive time is ${duration}. Plan fuel and rest breaks accordingly.`;
}
