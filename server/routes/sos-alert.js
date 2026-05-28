import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { googleMapsLink } from "../lib/liveTripHelpers.js";

/** POST /api/sos-alert — emergency SMS to owner's emergency contact (placeholder until Twilio verified). */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { shareToken, latitude, longitude } = req.body || {};
  if (!shareToken) {
    return res.status(400).json({ error: "Missing shareToken" });
  }

  try {
    const { data: trip, error: tripErr } = await admin
      .from("live_trips")
      .select("*")
      .eq("share_token", shareToken)
      .maybeSingle();

    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const lat = latitude ?? trip.latitude;
    const lng = longitude ?? trip.longitude;
    if (lat == null || lng == null) {
      return res.status(400).json({ error: "Location unavailable" });
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("emergency_contact_phone")
      .eq("user_id", trip.user_id)
      .maybeSingle();

    const user = await getUserFromRequest(req);
    if (user && user.id !== trip.user_id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const name = trip.traveler_display_name || "Traveler";
    const mapsLink = googleMapsLink(lat, lng);
    const message = `EMERGENCY: ${name} needs help. Current location: ${mapsLink}. Trip: ${trip.origin} to ${trip.destination}.`;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const toPhone = profile?.emergency_contact_phone;

    if (!toPhone) {
      return res.status(400).json({ error: "No emergency contact on file. Add one in your profile." });
    }

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(200).json({
        ok: true,
        placeholder: true,
        message: "Emergency SMS coming soon — Twilio verification pending",
      });
    }

    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ from: fromNumber, to: toPhone, body: message });

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error("sos-alert error:", err);
    return res.status(500).json({ error: "Could not send SOS alert" });
  }
}
