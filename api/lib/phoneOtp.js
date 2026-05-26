import crypto from "crypto";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

export function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

export function hashOtp(code, phone) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "tripmappa-otp";
  return crypto.createHash("sha256").update(`${phone}:${code}:${secret}`).digest("hex");
}

export function normalizeUsPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function validateUsPhone(input) {
  const normalized = normalizeUsPhone(input);
  if (!normalized) return { ok: false, error: "Enter a valid 10-digit US phone number" };
  const national = normalized.slice(2);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) {
    return { ok: false, error: "Enter a valid US phone number" };
  }
  return { ok: true, phone: normalized };
}

export function formatPhoneDisplay(phone) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export async function countRecentOtpRequests(admin, phone) {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("sms_otp_codes")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export async function storeOtp(admin, phone, code) {
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  const { error } = await admin.from("sms_otp_codes").insert({
    phone,
    code_hash: hashOtp(code, phone),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return expiresAt;
}

export async function verifyStoredOtp(admin, phone, code) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("sms_otp_codes")
    .select("id, code_hash, expires_at, verified_at")
    .eq("phone", phone)
    .is("verified_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, error: "expired", message: "Code expired. Tap Resend Code." };
  if (hashOtp(code, phone) !== data.code_hash) {
    return { ok: false, error: "invalid", message: "Incorrect code. Try again." };
  }

  await admin.from("sms_otp_codes").update({ verified_at: now }).eq("id", data.id);
  return { ok: true };
}

export { OTP_TTL_MS, RATE_LIMIT_MAX };
