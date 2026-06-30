import crypto from "crypto";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import {
  guardProxyRoute,
  isValidItineraryShareId,
  clampString,
} from "../lib/apiSecurity.js";

const MAX_PAYLOAD_BYTES = 512_000;
const SHARE_TTL_DAYS = 90;

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

function publicShareRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    ...payload,
    origin: payload.origin || row.origin,
    dest: payload.dest || row.destination,
    shareMeta: {
      shareId: row.share_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      stopCount: row.stop_count,
      dayCount: row.day_count,
    },
  };
}

function countTripDays(stops = [], answers = {}) {
  const nights = Number(answers?.trip_nights);
  if (Number.isFinite(nights) && nights > 0) return nights + 1;
  const overnightStops = (stops || []).filter(s => s && (s.city || s.name));
  return Math.max(1, overnightStops.length || 1);
}

function countPlanStops(stops = [], roadStops = []) {
  return (stops?.length || 0) + (roadStops?.length || 0);
}

/** POST /api/itinerary-share — persist a read-only trip snapshot. GET ?id= — load by share id. */
export default async function handler(req, res) {
  if (guardProxyRoute(req, res, "itinerary-share")) return undefined;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const shareId = String(req.query?.id || "").trim();
    if (!isValidItineraryShareId(shareId)) {
      return res.status(400).json({ error: "Invalid share id" });
    }
    if (req.method === "HEAD") return res.status(200).end();

    try {
      const { data, error } = await admin
        .from("shared_itineraries")
        .select("share_id, origin, destination, stop_count, day_count, payload, created_at, expires_at")
        .eq("share_id", shareId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Shared trip not found" });
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: "This share link has expired" });
      }

      return res.status(200).json({ trip: publicShareRow(data) });
    } catch (err) {
      console.error("itinerary-share GET error:", err);
      return res.status(500).json({ error: "Could not load shared trip" });
    }
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const origin = clampString(body.origin, 200).trim();
  const dest = clampString(body.dest || body.destination, 200).trim();
  if (!origin || !dest) {
    return res.status(400).json({ error: "Missing origin or destination" });
  }

  const payload = {
    origin,
    dest,
    stops: Array.isArray(body.stops) ? body.stops : [],
    roadStops: Array.isArray(body.roadStops) ? body.roadStops : [],
    tripTips: Array.isArray(body.tripTips) ? body.tripTips : [],
    answers: body.answers && typeof body.answers === "object" ? body.answers : {},
    routeInfo: body.routeInfo && typeof body.routeInfo === "object" ? body.routeInfo : null,
    selectedLodging: Array.isArray(body.selectedLodging) ? body.selectedLodging : [],
    personalTouches: Array.isArray(body.personalTouches) ? body.personalTouches : [],
    changesMade: Array.isArray(body.changesMade) ? body.changesMade : [],
    created: Date.now(),
  };

  let payloadJson;
  try {
    payloadJson = JSON.stringify(payload);
  } catch {
    return res.status(400).json({ error: "Invalid trip payload" });
  }
  if (payloadJson.length > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: "Trip payload too large to share" });
  }

  const user = await getUserFromRequest(req);
  const shareId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const stopCount = countPlanStops(payload.stops, payload.roadStops);
  const dayCount = countTripDays(payload.stops, payload.answers);

  try {
    const { data, error } = await admin
      .from("shared_itineraries")
      .insert({
        share_id: shareId,
        user_id: user?.id || null,
        origin,
        destination: dest,
        stop_count: stopCount,
        day_count: dayCount,
        payload,
        expires_at: expiresAt,
      })
      .select("share_id")
      .single();

    if (error) throw error;

    const shareUrl = `${shareBaseUrl(req)}/?share=${data.share_id}`;
    return res.status(200).json({
      shareId: data.share_id,
      shareUrl,
      expiresAt,
      stopCount,
      dayCount,
    });
  } catch (err) {
    console.error("itinerary-share POST error:", err);
    return res.status(500).json({ error: "Could not create share link" });
  }
}
