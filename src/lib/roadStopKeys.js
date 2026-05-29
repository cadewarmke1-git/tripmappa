/** Stable key for road stop add-to-trip tracking. */
import { placeDedupKey, placesMatch } from "./placesDedup.js";

export function normalizeRoadStopEntry(stop) {
  if (!stop) return null;
  if (stop.stopData && typeof stop.stopData === "object") {
    return { ...stop.stopData, ...stop, stopData: stop.stopData };
  }
  return stop;
}

export function roadStopExistsInList(stops, candidate) {
  const normalized = normalizeRoadStopEntry(candidate);
  if (!normalized) return false;
  const key = roadStopKey(normalized);
  return (stops || []).some(existing => placesMatch(existing, normalized) || (key && roadStopKey(existing) === key));
}

export function roadStopKey(stop) {
  const dedup = placeDedupKey(stop);
  if (dedup) return dedup;
  if (!stop) return "";
  const id = stop.id || stop.placeId || stop.stopData?.id || stop.stopData?.placeId;
  if (id) return String(id);
  const name = stop.title || stop.name || stop.stopData?.name || "stop";
  const lat = stop.lat ?? stop.stopData?.lat;
  const lng = stop.lng ?? stop.stopData?.lng;
  return `${name}-${lat ?? ""}-${lng ?? ""}`;
}
