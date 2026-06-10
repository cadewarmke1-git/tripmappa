import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { guardTokenWriteRoute, isValidShareToken } from "../lib/apiSecurity.js";
import {
  appendBreadcrumb,
  checkArrival,
  checkEtaNotifications,
  getNextOvernightStop,
  mphFromSpeedMps,
  sumBreadcrumbMiles,
} from "../lib/liveTripHelpers.js";

async function fetchMatrixEta(originLat, originLng, destination) {
  const key = getGoogleMapsKey();
  if (!key || !destination) return null;

  const origins = `${originLat},${originLng}`;
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origins);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("key", key);
  url.searchParams.set("departure_time", "now");
  url.searchParams.set("traffic_model", "best_guess");

  const res = await fetch(url);
  const data = await res.json();
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") return null;
  return {
    durationText: el.duration_in_traffic?.text || el.duration?.text || null,
    durationSeconds: el.duration_in_traffic?.value || el.duration?.value || null,
    distanceText: el.distance?.text || null,
    distanceMeters: el.distance?.value || null,
  };
}

async function trySendSms(phones, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber || !phones?.length) {
    return { sent: false, placeholder: true };
  }
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await Promise.all(phones.map(phone =>
      client.messages.create({ from: fromNumber, to: phone, body: message }),
    ));
    return { sent: true, placeholder: false };
  } catch {
    return { sent: false, placeholder: true };
  }
}

/** POST /api/update-location — owner GPS + breadcrumbs + ETA + arrival. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardTokenWriteRoute(req, res)) return undefined;

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const {
    shareToken,
    latitude,
    longitude,
    speedMps = null,
    stops: bodyStops,
  } = req.body || {};

  if (!isValidShareToken(shareToken) || latitude == null || longitude == null) {
    return res.status(400).json({ error: "Missing shareToken, latitude, or longitude" });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  try {
    const { data: existing, error: fetchErr } = await admin
      .from("live_trips")
      .select("*")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) {
      return res.status(404).json({ error: "Live trip not found or inactive" });
    }
    if (existing.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const stops = bodyStops || existing.stops || [];
    const nextStop = getNextOvernightStop(stops);
    const nextStopDest = nextStop?.city || null;
    const breadcrumbs = appendBreadcrumb(existing.breadcrumbs, lat, lng);

    const [destEta, nextStopEta] = await Promise.all([
      fetchMatrixEta(lat, lng, existing.destination),
      nextStopDest ? fetchMatrixEta(lat, lng, nextStopDest) : Promise.resolve(null),
    ]);

    const etaNotify = checkEtaNotifications({
      nextStopEta: nextStopEta,
      nextStopName: nextStopDest,
      travelerName: existing.traveler_display_name,
      sent: existing.eta_notifications_sent,
      followerPhones: existing.follower_phones,
    });

    for (const n of etaNotify.notifications) {
      if (n.sms && n.followerPhones?.length) {
        await trySendSms(n.followerPhones, n.message);
      }
    }

    const arrival = checkArrival({
      destEta,
      arrivedAt: existing.arrived_at,
    });

    const patch = {
      latitude: lat,
      longitude: lng,
      last_updated: new Date().toISOString(),
      breadcrumbs,
      total_distance_miles: sumBreadcrumbMiles(breadcrumbs),
      eta: destEta?.durationText || existing.eta,
      eta_destination: destEta?.durationText || null,
      eta_next_stop: nextStopEta?.durationText || null,
      next_stop_name: nextStopDest,
      eta_notifications_sent: etaNotify.eta_notifications_sent,
      last_notification: etaNotify.last_notification || existing.last_notification,
      owner_speed_mph: mphFromSpeedMps(speedMps),
      owner_distance_to_dest: destEta?.distanceText || null,
    };

    if (arrival.arrivedAt && !existing.arrived_at) {
      patch.arrived_at = arrival.arrivedAt;
    }
    if (arrival.deactivate) {
      patch.is_active = false;
    }

    const { data, error } = await admin
      .from("live_trips")
      .update(patch)
      .eq("share_token", shareToken)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      liveTrip: data,
      eta: { destination: destEta, nextStop: nextStopEta ? { ...nextStopEta, stopName: nextStopDest } : null },
      notification: etaNotify.last_notification,
      arrived: arrival.arrived && !existing.arrived_at,
      arrivalComplete: arrival.deactivate,
    });
  } catch (err) {
    console.error("update-location error:", err);
    return res.status(500).json({ error: "Could not update location" });
  }
}
