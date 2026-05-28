import twilio from "twilio";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  generateOtp,
  validateUsPhone,
  countRecentOtpRequests,
  storeOtp,
  RATE_LIMIT_MAX,
} from "../lib/phoneOtp.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone: rawPhone } = req.body || {};
  const validation = validateUsPhone(rawPhone);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }
  const phone = validation.phone;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromNumber) {
    return res.status(503).json({ error: "SMS service is not configured" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database is not configured" });
  }

  try {
    const recentCount = await countRecentOtpRequests(admin, phone);
    if (recentCount >= RATE_LIMIT_MAX) {
      return res.status(429).json({
        error: "Too many codes requested. Try again in 10 minutes.",
      });
    }

    const code = generateOtp();
    const expiresAt = await storeOtp(admin, phone, code);

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: fromNumber,
      to: phone,
      body: `Your TripMappa verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`,
    });

    return res.status(200).json({ ok: true, phone, expiresAt });
  } catch (err) {
    console.error("send-sms-otp error:", err);
    return res.status(500).json({ error: "Could not send verification code" });
  }
}
