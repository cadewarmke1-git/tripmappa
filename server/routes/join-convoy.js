import crypto from "crypto";
import { captureServerException } from "../lib/sentry.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { assignConvoyColor } from "../lib/liveTripHelpers.js";
import { guardTokenWriteRoute, isValidShareToken } from "../lib/apiSecurity.js";

/** POST /api/join-convoy — register a convoy member on an active live trip. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardTokenWriteRoute(req, res)) return undefined;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { shareToken, displayName, memberId: existingMemberId } = req.body || {};
  if (!isValidShareToken(shareToken)) {
    return res.status(400).json({ error: "Missing shareToken" });
  }

  const name = (displayName || "Convoy Member").trim().slice(0, 40);

  try {
    const { data: trip, error: fetchErr } = await admin
      .from("live_trips")
      .select("*")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!trip) return res.status(404).json({ error: "Live trip not found" });
    if (!trip.convoy_mode) {
      return res.status(403).json({ error: "Convoy mode is not enabled for this trip" });
    }

    const members = Array.isArray(trip.convoy_members) ? [...trip.convoy_members] : [];
    let member = members.find(m => m.id === existingMemberId);

    if (!member) {
      if (members.length >= 5) {
        return res.status(409).json({ error: "Convoy is full (5 members max)" });
      }
      member = {
        id: crypto.randomBytes(8).toString("hex"),
        name,
        color: assignConvoyColor(members),
        joined_at: new Date().toISOString(),
      };
      members.push(member);
    } else {
      member.name = name;
    }

    const { data, error } = await admin
      .from("live_trips")
      .update({ convoy_members: members })
      .eq("share_token", shareToken)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ member, liveTrip: data });
  } catch (err) {
    console.error("join-convoy error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Could not join convoy" });
  }
}
