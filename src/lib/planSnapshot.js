/** Detect when plan inputs changed after the last successful generation. */
import { getEffectiveVehicle } from "./vehicles.js";

const SNAPSHOT_ANSWER_KEYS = [
  "vehicle",
  "effective_vehicle",
  "primary_vehicle",
  "multi_vehicles",
  "fuel_type",
  "towing",
  "travelers",
  "overnight_preference",
  "lodging",
  "loyalty_program",
  "dietary",
  "accessibility",
  "preferences",
  "stops_interests",
  "trip_budget",
  "schedule_restrictions",
  "schedule_drive_hours",
  "food_allergies",
  "coordination_needs",
  "route_restrictions",
];

export function buildPlanSnapshot({ origin = "", dest = "", answers = {}, routeInfo = null } = {}) {
  const answerSlice = {};
  SNAPSHOT_ANSWER_KEYS.forEach((key) => {
    if (answers[key] !== undefined) answerSlice[key] = answers[key];
  });
  answerSlice.effective_vehicle = getEffectiveVehicle(answers);

  return JSON.stringify({
    origin: String(origin).trim().toLowerCase(),
    dest: String(dest).trim().toLowerCase(),
    answers: answerSlice,
    routeDistance: routeInfo?.distance ?? null,
    routeDuration: routeInfo?.duration ?? null,
  });
}

export function isPlanOutOfDate(savedSnapshot, currentSnapshot) {
  if (!savedSnapshot || !currentSnapshot) return false;
  return savedSnapshot !== currentSnapshot;
}
