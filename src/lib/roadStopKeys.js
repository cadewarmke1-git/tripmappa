/** Stable key for road stop add-to-trip tracking. */
export function roadStopKey(stop) {
  if (!stop) return "";
  const id = stop.id || stop.placeId || stop.stopData?.id || stop.stopData?.placeId;
  if (id) return String(id);
  const name = stop.title || stop.name || stop.stopData?.name || "stop";
  const lat = stop.lat ?? stop.stopData?.lat;
  const lng = stop.lng ?? stop.stopData?.lng;
  return `${name}-${lat ?? ""}-${lng ?? ""}`;
}
