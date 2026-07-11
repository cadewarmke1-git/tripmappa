import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { captureServerException } from "../lib/sentry.js";
import { guardProxyRoute, isValidShareToken } from "../lib/apiSecurity.js";

function publicLiveTripRow(row) {
  if (!row) return null;
  const { follower_phones: _phones, user_id: _uid, ...rest } = row;
  return rest;
}

/** GET /api/live-trip?token= — read one live trip by share token (no enumeration). */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardProxyRoute(req, res)) return undefined;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const token = String(req.query?.token || "").trim();
  if (!isValidShareToken(token)) {
    return res.status(400).json({ error: "Invalid share token" });
  }

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  try {
    const { data, error } = await admin
      .from("live_trips")
      .select("*")
      .eq("share_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!data || (!data.is_active && !data.arrived_at)) {
      return res.status(404).json({ error: "Live trip not found" });
    }

    return res.status(200).json({ liveTrip: publicLiveTripRow(data) });
  } catch (err) {
    console.error("live-trip error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Could not load live trip" });
  }
}
