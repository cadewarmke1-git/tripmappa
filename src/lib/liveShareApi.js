import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Client API for live location sharing. */

export async function createLiveShare(accessToken, payload) {
  const res = await fetch("/api/share-trip", {
    method: "POST",
    headers: tripMappaApiHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not create share link");
  return data;
}

export async function updateLiveLocation({ shareToken, latitude, longitude, stops, speedMps, accessToken }) {
  const headers = tripMappaApiHeaders({ "Content-Type": "application/json" });
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch("/api/update-location", {
    method: "POST",
    headers,
    body: JSON.stringify({ shareToken, latitude, longitude, stops, speedMps }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not update location");
  return data;
}

export async function joinConvoy({ shareToken, displayName, memberId }) {
  const res = await fetch("/api/join-convoy", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shareToken, displayName, memberId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not join convoy");
  return data;
}

export async function updateConvoyLocation({ shareToken, memberId, latitude, longitude, speedMps }) {
  const res = await fetch("/api/update-convoy-location", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shareToken, memberId, latitude, longitude, speedMps }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not update convoy location");
  return data;
}

export async function registerFollowerPhone({ shareToken, phone }) {
  const res = await fetch("/api/register-follower-phone", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ shareToken, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not register phone");
  return data;
}

export async function sendSosAlert({ shareToken, latitude, longitude, accessToken }) {
  const headers = tripMappaApiHeaders({ "Content-Type": "application/json" });
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch("/api/sos-alert", {
    method: "POST",
    headers,
    body: JSON.stringify({ shareToken, latitude, longitude }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not send SOS");
  return data;
}

export function getLiveShareUrl(token) {
  return `${window.location.origin}/live/${token}`;
}

export function parseLiveShareToken(pathname = window.location.pathname) {
  const match = pathname.match(/^\/live\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
