import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { captureServerException } from "../lib/sentry.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import {
  appendInvitee,
  appendSuggestion,
  buildCollabLink,
  newParticipantId,
  sanitizeInviteContact,
  upsertPreferences,
  upsertVote,
} from "../lib/collaborationStore.js";
import {
  guardProxyRoute,
  guardTokenWriteRoute,
  isValidInviteToken,
} from "../lib/apiSecurity.js";
import { isSoloTraveler } from "../../src/lib/vehicles.js";

function isSoloTripSnapshot(snapshot = {}) {
  const answers = snapshot?.answers && typeof snapshot.answers === "object" ? snapshot.answers : snapshot;
  return isSoloTraveler(answers?.travelers);
}

function redactInvitees(invitees, includePii) {
  if (includePii) return invitees || [];
  return (invitees || []).map(({ name, status, invitedAt }) => ({
    name: name || null,
    status: status || null,
    invitedAt: invitedAt || null,
  }));
}

function publicCollabRow(row, req, viewerUserId = null) {
  if (!row) return null;
  const isOrganizer = Boolean(viewerUserId && viewerUserId === row.organizer_id);
  return {
    id: row.id,
    tripId: row.trip_id,
    organizerId: row.organizer_id,
    inviteToken: row.invite_token,
    tripSnapshot: row.trip_snapshot,
    invitees: redactInvitees(row.invitees, isOrganizer),
    votes: row.votes,
    suggestions: row.suggestions,
    preferences: row.preferences,
    status: row.status,
    updatedAt: row.updated_at,
    collabUrl: buildCollabLink(req, row.invite_token),
  };
}

/** GET ?token= — load session. POST { action } — create, invite, vote, suggest, preferences */
export default async function handler(req, res) {
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: "Database not configured" });

  if (req.method === "GET") {
    if (guardProxyRoute(req, res, "collaboration")) return undefined;
    const token = String(req.query?.token || "").trim();
    if (!isValidInviteToken(token)) return res.status(400).json({ error: "Invalid token" });
    const { data, error } = await admin
      .from("trip_collaborations")
      .select("*")
      .eq("invite_token", token)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Collaboration not found" });
    return res.status(200).json({ collaboration: publicCollabRow(data, req) });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardTokenWriteRoute(req, res, "collaboration")) return undefined;

  const { action } = req.body || {};
  const user = await getUserFromRequest(req);

  try {
    if (action === "create") {
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      const { tripId = null, tripSnapshot = {} } = req.body || {};
      if (isSoloTripSnapshot(tripSnapshot)) {
        return res.status(400).json({ error: "Group collaboration requires more than one traveler" });
      }
      const { data, error } = await admin
        .from("trip_collaborations")
        .insert({
          organizer_id: user.id,
          trip_id: tripId || null,
          trip_snapshot: tripSnapshot,
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ collaboration: publicCollabRow(data, req, user.id) });
    }

    if (action === "invite") {
      if (!user) return res.status(401).json({ error: "Not authenticated" });
      const { collaborationId, email, phone, name } = req.body || {};
      if (!collaborationId) return res.status(400).json({ error: "Missing collaborationId" });
      const { data: row, error: fetchErr } = await admin
        .from("trip_collaborations")
        .select("*")
        .eq("id", collaborationId)
        .eq("organizer_id", user.id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!row) return res.status(404).json({ error: "Collaboration not found" });
      if (isSoloTripSnapshot(row.trip_snapshot)) {
        return res.status(400).json({ error: "Invites require a multi-traveler trip" });
      }
      const emailClean = sanitizeInviteContact(email);
      const phoneClean = sanitizeInviteContact(phone);
      if (!emailClean && !phoneClean) {
        return res.status(400).json({ error: "Email or phone is required" });
      }
      const collabUrl = buildCollabLink(req, row.invite_token);
      const invitees = appendInvitee(row.invitees, {
        email: emailClean,
        phone: phoneClean,
        name: sanitizeInviteContact(name),
        collabUrl,
      });
      const { data, error } = await admin
        .from("trip_collaborations")
        .update({ invitees })
        .eq("id", collaborationId)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({
        collaboration: publicCollabRow(data, req, user.id),
        participantId: newParticipantId(),
      });
    }

    const token = String(req.body?.inviteToken || "").trim();
    if (!isValidInviteToken(token)) return res.status(400).json({ error: "Missing inviteToken" });

    const { data: row, error: loadErr } = await admin
      .from("trip_collaborations")
      .select("*")
      .eq("invite_token", token)
      .eq("status", "active")
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!row) return res.status(404).json({ error: "Collaboration not found" });

    if (action === "vote") {
      const { participantId, stopKey, vote, displayName } = req.body || {};
      if (!participantId || !stopKey) return res.status(400).json({ error: "Missing vote fields" });
      const votes = upsertVote(row.votes, { participantId, stopKey, vote, displayName });
      const { data, error } = await admin
        .from("trip_collaborations")
        .update({ votes })
        .eq("id", row.id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ collaboration: publicCollabRow(data, req, user?.id) });
    }

    if (action === "suggest") {
      const { participantId, stopIndex, placeName, note, displayName } = req.body || {};
      if (!participantId || !placeName?.trim()) {
        return res.status(400).json({ error: "Missing suggestion fields" });
      }
      const suggestions = appendSuggestion(row.suggestions, {
        participantId, stopIndex, placeName, note, displayName,
      });
      const { data, error } = await admin
        .from("trip_collaborations")
        .update({ suggestions })
        .eq("id", row.id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ collaboration: publicCollabRow(data, req, user?.id) });
    }

    if (action === "preferences") {
      const { participantId, dietary, travelPreferences, displayName } = req.body || {};
      if (!participantId) return res.status(400).json({ error: "Missing participantId" });
      const preferences = upsertPreferences(row.preferences, {
        participantId, dietary, travelPreferences, displayName,
      });
      const { data, error } = await admin
        .from("trip_collaborations")
        .update({ preferences })
        .eq("id", row.id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ collaboration: publicCollabRow(data, req, user?.id) });
    }

    if (action === "close") {
      if (!user || user.id !== row.organizer_id) {
        return res.status(403).json({ error: "Only the organizer can close" });
      }
      const { data, error } = await admin
        .from("trip_collaborations")
        .update({ status: "closed" })
        .eq("id", row.id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ collaboration: publicCollabRow(data, req, user.id) });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    console.error("collaboration error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Collaboration request failed" });
  }
}
