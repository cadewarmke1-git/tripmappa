import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { captureServerException } from "../lib/sentry.js";
import { validateUsPhone, verifyStoredOtp } from "../lib/phoneOtp.js";
import { guardTokenWriteRoute, isValidShareToken, MAX_FOLLOWER_PHONES } from "../lib/apiSecurity.js";

/** POST /api/register-follower-phone — follower opts in to ETA SMS after OTP proof. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardTokenWriteRoute(req, res)) return undefined;

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { shareToken, phone: rawPhone, otpCode } = req.body || {};
  if (!isValidShareToken(shareToken) || !rawPhone) {
    return res.status(400).json({ error: "Missing shareToken or phone" });
  }

  const validation = validateUsPhone(rawPhone);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }

  const trimmedCode = String(otpCode || "").trim();
  if (!/^\d{6}$/.test(trimmedCode)) {
    return res.status(400).json({
      error: "SMS verification code required before registering a follower phone",
      code: "otp_required",
    });
  }

  try {
    const otpResult = await verifyStoredOtp(admin, validation.phone, trimmedCode);
    if (!otpResult.ok) {
      const status = otpResult.error === "expired" ? 410 : 401;
      return res.status(status).json({ error: otpResult.message, code: otpResult.error });
    }

    const { data: trip, error: fetchErr } = await admin
      .from("live_trips")
      .select("follower_phones")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!trip) return res.status(404).json({ error: "Live trip not found" });

    const phones = Array.isArray(trip.follower_phones) ? [...trip.follower_phones] : [];
    if (!phones.includes(validation.phone)) {
      if (phones.length >= MAX_FOLLOWER_PHONES) {
        return res.status(409).json({ error: "Follower phone list is full" });
      }
      phones.push(validation.phone);
    }

    const { error } = await admin
      .from("live_trips")
      .update({ follower_phones: phones })
      .eq("share_token", shareToken);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("register-follower-phone error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Could not register phone" });
  }
}
