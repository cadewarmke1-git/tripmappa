import crypto from "crypto";

export function newParticipantId() {
  return crypto.randomBytes(12).toString("hex");
}

export function collabBaseUrl(req) {
  const envUrl = process.env.SITE_URL || process.env.VERCEL_URL;
  if (envUrl) {
    const base = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return base.replace(/\/$/, "");
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function buildCollabLink(req, inviteToken) {
  return `${collabBaseUrl(req)}/collab/${inviteToken}`;
}

export function sanitizeInviteContact(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

export function upsertVote(votes, { participantId, stopKey, vote, displayName }) {
  const list = Array.isArray(votes) ? [...votes] : [];
  const idx = list.findIndex(v => v.participantId === participantId && v.stopKey === stopKey);
  const row = {
    participantId,
    stopKey,
    vote: vote === -1 ? -1 : 1,
    displayName: (displayName || "Guest").slice(0, 60),
    votedAt: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  return list;
}

export function appendSuggestion(suggestions, row) {
  const list = Array.isArray(suggestions) ? [...suggestions] : [];
  list.push({
    id: crypto.randomUUID(),
    participantId: row.participantId,
    displayName: (row.displayName || "Guest").slice(0, 60),
    stopIndex: Number.isFinite(row.stopIndex) ? row.stopIndex : null,
    placeName: String(row.placeName || "").trim().slice(0, 200),
    note: String(row.note || "").trim().slice(0, 500),
    createdAt: new Date().toISOString(),
  });
  return list;
}

export function upsertPreferences(preferences, row) {
  const list = Array.isArray(preferences) ? [...preferences] : [];
  const idx = list.findIndex(p => p.participantId === row.participantId);
  const entry = {
    participantId: row.participantId,
    displayName: (row.displayName || "Guest").slice(0, 60),
    dietary: String(row.dietary || "").trim().slice(0, 500),
    travelPreferences: String(row.travelPreferences || "").trim().slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  return list;
}

export function appendInvitee(invitees, { email, phone, name, collabUrl }) {
  const list = Array.isArray(invitees) ? [...invitees] : [];
  list.push({
    id: crypto.randomUUID(),
    email: email || null,
    phone: phone || null,
    name: (name || "").slice(0, 80) || null,
    collabUrl: collabUrl || null,
    invitedAt: new Date().toISOString(),
    respondedAt: null,
  });
  return list;
}

