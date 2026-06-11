/** Resolve results hero variant from trip category, answers, and overnight stops. */
import { isContinuousDrive } from "./driveMode.js";
import {
  getEffectiveVehicle,
  isScenicRoute,
  isTruckVehicle,
  isWaterVehicle,
  MULTI_VEHICLE_TRIP,
  skipLodgingQuestion,
} from "./vehicles.js";

export function classifyTripCategory(answers) {
  const rawVehicle = answers?.vehicle || "Car";
  const vehicle = getEffectiveVehicle(answers);
  if (rawVehicle === MULTI_VEHICLE_TRIP) return "multi";
  if (vehicle === "Plane" || rawVehicle === "Plane" || answers?.trip_type === "Flying") return "plane";
  if (isWaterVehicle(vehicle) || isWaterVehicle(rawVehicle) || answers?.trip_type === "Ferry or Cruise") {
    return "water";
  }
  if (isTruckVehicle(vehicle) || answers?.trip_type === "Work or Delivery run") return "commercial";
  if (vehicle === "RV" || vehicle === "Camper Van") return "rv";
  return "personal";
}

export function countOvernightNights(stops = []) {
  return stops.filter(s => s?.city).length;
}

function isDayTripShape(answers, stops = []) {
  if (isContinuousDrive(answers)) return false;
  if (skipLodgingQuestion(answers?.trip_type, getEffectiveVehicle(answers))) return true;
  return countOvernightNights(stops) === 0;
}

/**
 * @returns {"truck"|"multiDay"|"overnight"|"scenicDay"|"day"}
 */
export function resolveHeroVariant(answers, tripCategory, stops = []) {
  const category = tripCategory || classifyTripCategory(answers);
  const nights = countOvernightNights(stops);

  if (category === "commercial") return "truck";
  if (nights >= 2) return "multiDay";
  if (nights === 1) return "overnight";
  if (isDayTripShape(answers, stops) && isScenicRoute(answers)) return "scenicDay";
  return "day";
}

/** Scenic preference adds highlight chips under multi-night / overnight heroes — not scenicDay. */
export function shouldShowRouteHighlightChips(answers, variant) {
  return isScenicRoute(answers) && (variant === "multiDay" || variant === "overnight" || variant === "truck");
}
