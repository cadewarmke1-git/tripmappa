/** Server-backed itinerary share API (read-only snapshots for ?share= links). */
import { stripSessionOnlyAnswers } from "./tripHandlers.js";
import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

export function buildItinerarySharePayload(trip) {
  return {
    origin: trip.origin,
    dest: trip.dest,
    stops: trip.stops || [],
    roadStops: trip.roadStops || [],
    tripTips: trip.tripTips || [],
    answers: stripSessionOnlyAnswers(trip.answers || {}),
    routeInfo: trip.routeInfo || null,
    selectedLodging: trip.selectedLodging || [],
    personalTouches: trip.personalTouches || [],
    changesMade: trip.changesMade || [],
  };
}

export async function publishItineraryShare(trip, accessToken = null) {
  const headers = tripMappaApiHeaders({ "Content-Type": "application/json" });
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch("/api/itinerary-share", {
    method: "POST",
    headers,
    body: JSON.stringify(buildItinerarySharePayload(trip)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || "Could not create share link");
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function fetchItineraryShare(shareId) {
  const response = await fetch(
    `/api/itinerary-share?id=${encodeURIComponent(shareId)}`,
    { headers: tripMappaApiHeaders() },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || "Could not load shared trip");
    err.status = response.status;
    throw err;
  }
  return data.trip || null;
}

export function applySharePageMeta({ origin, dest, stopCount, dayCount } = {}) {
  if (typeof document === "undefined") return;
  const from = String(origin || "").split(",")[0].trim();
  const to = String(dest || "").split(",")[0].trim();
  const route = from && to ? `${from} → ${to}` : "Road trip";
  const stats = [
    dayCount === 1 ? "1 day" : dayCount > 1 ? `${dayCount} days` : null,
    stopCount > 0 ? `${stopCount} stops` : null,
  ].filter(Boolean).join(" · ");
  const title = stats ? `${route} · ${stats} · TripMappa` : `${route} · TripMappa`;
  document.title = title;

  const setMeta = (property, content) => {
    let el = document.querySelector(`meta[property="${property}"]`)
      || document.querySelector(`meta[name="${property}"]`);
    if (!el) {
      el = document.createElement("meta");
      if (property.startsWith("og:")) el.setAttribute("property", property);
      else el.setAttribute("name", property);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const description = `A ready-to-drive road trip itinerary on TripMappa — ${route}${stats ? ` (${stats})` : ""}.`;
  setMeta("og:title", title);
  setMeta("og:description", description);
  setMeta("description", description);
}
