import crypto from "crypto";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";

function generateShareToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function shareBaseUrl(req) {
  const envUrl = process.env.SITE_URL || process.env.VERCEL_URL;
  if (envUrl) {
    const base = envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
    return base.replace(/\/$/, "");
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

/** POST /api/share-trip — create or refresh a live share link for the active trip. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const {
    tripId = null,
    origin,
    destination,
    stops = [],
    eta = null,
    routeInfo = null,
    latitude = null,
    longitude = null,
    travelerDisplayName = null,
    travelerAvatarUrl = null,
    existingShareToken = null,
    convoyMode = false,
  } = req.body || {};

  if (!origin?.trim() || !destination?.trim()) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  try {
    await admin
      .from("live_trips")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .neq("share_token", existingShareToken || "");

    if (existingShareToken) {
      const { data: existingRow } = await admin
        .from("live_trips")
        .select("user_id")
        .eq("share_token", existingShareToken)
        .maybeSingle();
      if (existingRow && existingRow.user_id !== user.id) {
        return res.status(403).json({ error: "Not authorized for this share token" });
      }
    }

    const shareToken = existingShareToken || generateShareToken();
    const now = new Date().toISOString();

    const row = {
      user_id: user.id,
      trip_id: tripId || null,
      share_token: shareToken,
      origin: origin.trim(),
      destination: destination.trim(),
      stops: Array.isArray(stops) ? stops : [],
      eta: eta || routeInfo?.duration || null,
      route_info: routeInfo || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      last_updated: latitude != null && longitude != null ? now : null,
      is_active: true,
      traveler_display_name: travelerDisplayName || user.user_metadata?.full_name || user.email?.split("@")[0] || "Traveler",
      traveler_avatar_url: travelerAvatarUrl || null,
      convoy_mode: Boolean(convoyMode),
      trip_started_at: now,
      breadcrumbs: latitude != null && longitude != null ? [{ lat: latitude, lng: longitude, t: now }] : [],
    };

    const { data, error } = await admin
      .from("live_trips")
      .upsert(row, { onConflict: "share_token" })
      .select()
      .single();

    if (error) throw error;

    const shareUrl = `${shareBaseUrl(req)}/live/${data.share_token}`;
    return res.status(200).json({ shareUrl, shareToken: data.share_token, liveTrip: data });
  } catch (err) {
    console.error("share-trip error:", err);
    return res.status(500).json({ error: "Could not create share link" });
  }
}
