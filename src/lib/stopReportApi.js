import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

export const STOP_REPORT_REASONS = [
  { value: "closed", label: "Closed or permanently shut down" },
  { value: "wrong_location", label: "Wrong location on the map" },
  { value: "inaccurate_description", label: "Inaccurate description or details" },
  { value: "inappropriate", label: "Inappropriate suggestion" },
  { value: "other", label: "Something else" },
];

/** Normalize a results/itinerary card item into stop-report form context. */
export function buildStopReportTarget(sourceKind, item, categoryHint = null) {
  const stopData = item?.stopData || item || {};
  const stopName = String(item?.title || item?.name || "Stop").trim() || "Stop";
  const category = String(
    categoryHint
      || item?.category
      || (sourceKind === "fuel" ? "Fuel" : sourceKind)
      || "Stop",
  ).trim();

  return {
    sourceKind,
    stopName: stopName.slice(0, 200),
    category: category.slice(0, 80),
    placeId: item?.placeId || item?.place_id || item?.id || null,
    lat: item?.lat ?? stopData?.lat ?? null,
    lng: item?.lng ?? stopData?.lng ?? null,
  };
}

/** POST /api/stop-report — optional Bearer token attaches user_id. */
export async function submitStopReport({
  accessToken = null,
  tripId = null,
  target,
  reason,
  details = "",
}) {
  if (!target?.stopName || !reason) {
    throw new Error("Stop and reason are required");
  }

  const headers = tripMappaApiHeaders({
    "Content-Type": "application/json",
  });
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch("/api/stop-report", {
    method: "POST",
    headers,
    body: JSON.stringify({
      tripId: tripId || null,
      sourceKind: target.sourceKind,
      stopName: target.stopName,
      category: target.category,
      placeId: target.placeId,
      lat: target.lat,
      lng: target.lng,
      reason,
      details,
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Could not save report");
  }
  return data;
}
