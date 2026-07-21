/** Detect when plan inputs changed after the last successful generation. */
import { getEffectiveVehicle } from "./vehicles.js";

/**
 * Snapshot used for stale-results detection.
 * Only origin, destination, and vehicle type — minor preference / hydration
 * differences must not flag results as outdated.
 */
export function buildPlanSnapshot({ origin = "", dest = "", answers = {}, routeInfo: _routeInfo = null } = {}) {
  return JSON.stringify({
    origin: String(origin).trim().toLowerCase(),
    dest: String(dest).trim().toLowerCase(),
    vehicle: String(getEffectiveVehicle(answers) || "").trim().toLowerCase(),
  });
}

export function isPlanOutOfDate(savedSnapshot, currentSnapshot) {
  if (!savedSnapshot || !currentSnapshot) return false;
  return savedSnapshot !== currentSnapshot;
}
