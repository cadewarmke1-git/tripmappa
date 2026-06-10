import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { validateUsPhone, verifyStoredOtp } from "../lib/phoneOtp.js";
import { createPhoneSignInSession } from "../lib/phoneAuth.js";
import { guardProxyRoute } from "../lib/apiSecurity.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardProxyRoute(req, res, "otp_verify")) return undefined;

  const { phone: rawPhone, code } = req.body || {};
  const validation = validateUsPhone(rawPhone);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }
  const phone = validation.phone;

  const trimmedCode = String(code || "").trim();
  if (!/^\d{6}$/.test(trimmedCode)) {
    return res.status(400).json({ error: "Enter the 6-digit code" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database is not configured" });
  }

  try {
    const otpResult = await verifyStoredOtp(admin, phone, trimmedCode);
    if (!otpResult.ok) {
      const status = otpResult.error === "expired" ? 410 : 401;
      return res.status(status).json({ error: otpResult.message });
    }

    const session = await createPhoneSignInSession(admin, phone);
    return res.status(200).json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: session.user,
    });
  } catch (err) {
    console.error("verify-sms-otp error:", err);
    return res.status(500).json({ error: "Could not verify code" });
  }
}
