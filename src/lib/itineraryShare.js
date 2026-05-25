/** Read-only itinerary sharing via localStorage + URL param. */
import { stripSessionOnlyAnswers } from "./tripHandlers.js";

const PREFIX = "tripmappa-share-";

export function createItineraryShareLink(trip) {
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `share-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const payload = {
    origin: trip.origin,
    dest: trip.dest,
    stops: trip.stops || [],
    roadStops: trip.roadStops || [],
    tripTips: trip.tripTips || [],
    answers: stripSessionOnlyAnswers(trip.answers || {}),
    routeInfo: trip.routeInfo || null,
    selectedLodging: trip.selectedLodging || [],
    created: Date.now(),
  };

  try {
    localStorage.setItem(`${PREFIX}${id}`, JSON.stringify(payload));
  } catch {
    return null;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("share", id);
  return url.toString();
}

export function loadSharedItinerary(shareId) {
  if (!shareId) return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${shareId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
