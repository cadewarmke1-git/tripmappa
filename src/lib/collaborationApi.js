import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/** Trip collaboration API client. */

async function parseJson(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Collaboration request failed");
  return data;
}

export function getOrCreateParticipantId(inviteToken) {
  const key = `tripmappa-collab-participant-${inviteToken}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(key, id);
  }
  return id;
}

export async function fetchCollaboration(token) {
  const res = await fetch(`/api/collaboration?token=${encodeURIComponent(token)}`, {
    headers: tripMappaApiHeaders(),
  });
  return parseJson(res);
}

export async function createCollaboration(accessToken, { tripId, tripSnapshot }) {
  const res = await fetch("/api/collaboration", {
    method: "POST",
    headers: tripMappaApiHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    body: JSON.stringify({ action: "create", tripId, tripSnapshot }),
  });
  return parseJson(res);
}

export async function inviteToCollaboration(accessToken, { collaborationId, email, phone, name }) {
  const res = await fetch("/api/collaboration", {
    method: "POST",
    headers: tripMappaApiHeaders({
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    }),
    body: JSON.stringify({ action: "invite", collaborationId, email, phone, name }),
  });
  return parseJson(res);
}

export async function submitCollabVote({ inviteToken, participantId, stopKey, vote, displayName }) {
  const res = await fetch("/api/collaboration", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      action: "vote",
      inviteToken,
      participantId,
      stopKey,
      vote,
      displayName,
    }),
  });
  return parseJson(res);
}

export async function submitCollabSuggestion({ inviteToken, participantId, stopIndex, placeName, note, displayName }) {
  const res = await fetch("/api/collaboration", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      action: "suggest",
      inviteToken,
      participantId,
      stopIndex,
      placeName,
      note,
      displayName,
    }),
  });
  return parseJson(res);
}

export async function submitCollabPreferences({ inviteToken, participantId, dietary, travelPreferences, displayName }) {
  const res = await fetch("/api/collaboration", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      action: "preferences",
      inviteToken,
      participantId,
      dietary,
      travelPreferences,
      displayName,
    }),
  });
  return parseJson(res);
}

export function parseCollabToken(pathname = window.location.pathname) {
  const match = pathname.match(/^\/collab\/([^/]+)/);
  return match?.[1] || null;
}

/** Normalize API or realtime row into client collaboration shape. */
export function mapCollaborationFromDb(row, collabUrl = null) {
  if (!row) return null;
  const token = row.invite_token || row.inviteToken;
  return {
    id: row.id,
    tripId: row.trip_id ?? row.tripId ?? null,
    organizerId: row.organizer_id ?? row.organizerId,
    inviteToken: token,
    tripSnapshot: row.trip_snapshot ?? row.tripSnapshot ?? {},
    invitees: row.invitees || [],
    votes: row.votes || [],
    suggestions: row.suggestions || [],
    preferences: row.preferences || [],
    status: row.status,
    updatedAt: row.updated_at ?? row.updatedAt,
    collabUrl: collabUrl || row.collabUrl || (token ? `/collab/${token}` : null),
  };
}
