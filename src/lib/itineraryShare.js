/** Read-only itinerary sharing — server-backed with localStorage fallback. */
import {
  buildItinerarySharePayload,
  publishItineraryShare,
  fetchItineraryShare,
} from "./itineraryShareApi.js";

const PREFIX = "tripmappa-share-";

function buildLocalShareUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("share", id);
  url.searchParams.delete("skyHour");
  return url.toString();
}

function saveLocalShare(id, payload) {
  try {
    localStorage.setItem(`${PREFIX}${id}`, JSON.stringify({ ...payload, created: Date.now() }));
    return buildLocalShareUrl(id);
  } catch {
    return null;
  }
}

function loadLocalShare(shareId) {
  if (!shareId) return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${shareId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Create a portable share link (API first, localStorage fallback). */
export async function createItineraryShareLink(trip, accessToken = null) {
  try {
    const result = await publishItineraryShare(trip, accessToken);
    if (result?.shareUrl) return result.shareUrl;
  } catch {
    // Fall through to offline/same-device fallback.
  }

  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `share-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return saveLocalShare(id, buildItinerarySharePayload(trip));
}

/** Load a shared itinerary by id (API first, localStorage fallback). */
export async function loadSharedItinerary(shareId) {
  if (!shareId) return null;

  try {
    const remote = await fetchItineraryShare(shareId);
    if (remote) return remote;
  } catch (err) {
    if (err?.status && err.status !== 404 && err.status !== 410) {
      const local = loadLocalShare(shareId);
      if (local) return local;
      throw err;
    }
  }

  return loadLocalShare(shareId);
}
