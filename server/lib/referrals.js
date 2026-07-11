/** Referral codes, links, and Voyager bonus grants. */
import { buildUserProfileUpsertRow } from "./userProfileDefaults.js";

const REFERRAL_PARAM = "ref";

export function getSiteOrigin() {
  const fromEnv = process.env.TRIPMAPPA_SITE_URL || process.env.SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://tripmappa.com";
}

export function buildReferralLink(referralCode) {
  if (!referralCode) return null;
  const origin = getSiteOrigin();
  return `${origin}?${REFERRAL_PARAM}=${encodeURIComponent(referralCode)}`;
}

function referralCodeFromUserId(userId) {
  const compact = String(userId).replace(/-/g, "").slice(0, 10).toLowerCase();
  return `tm-${compact}`;
}

export async function ensureReferralCode(admin, userId) {
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("referral_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (profile?.referral_code) {
    return profile.referral_code;
  }

  let code = referralCodeFromUserId(userId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error: upsertErr } = await admin.from("user_profiles").upsert(
      buildUserProfileUpsertRow(userId, { referral_code: code }),
      { onConflict: "user_id" },
    );
    if (!upsertErr) return code;
    if (upsertErr.code !== "23505") throw upsertErr;
    code = `tm-${String(userId).replace(/-/g, "").slice(0, 6)}${Math.random().toString(36).slice(2, 6)}`;
  }

  throw new Error("Could not assign referral code");
}

async function addVoyagerBonusMonth(admin, userId) {
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("voyager_bonus_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const now = new Date();
  const existing = profile?.voyager_bonus_until
    ? new Date(profile.voyager_bonus_until)
    : null;
  const start =
    existing && !Number.isNaN(existing.getTime()) && existing > now
      ? existing
      : now;
  const ends = new Date(start);
  ends.setMonth(ends.getMonth() + 1);

  const { error: updateErr } = await admin
    .from("user_profiles")
    .update({ voyager_bonus_until: ends.toISOString() })
    .eq("user_id", userId);

  if (updateErr) throw updateErr;
  return ends.toISOString();
}

/**
 * Apply referral on first signup. Both parties receive one free month of Voyager.
 */
export async function processReferralSignup(admin, referredUserId, refCode) {
  const code = typeof refCode === "string" ? refCode.trim().toLowerCase() : "";
  if (!code) return { applied: false, reason: "no_code" };

  const { data: referrerProfile, error: findErr } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("referral_code", code)
    .maybeSingle();

  if (findErr) throw findErr;
  if (!referrerProfile?.user_id) return { applied: false, reason: "invalid_code" };
  if (referrerProfile.user_id === referredUserId) {
    return { applied: false, reason: "self_referral" };
  }

  const { error: insertErr } = await admin.from("referrals").insert({
    referrer_user_id: referrerProfile.user_id,
    referred_user_id: referredUserId,
  });

  if (insertErr) {
    if (insertErr.code === "23505") return { applied: false, reason: "already_referred" };
    throw insertErr;
  }

  const [referrerBonusUntil, referredBonusUntil] = await Promise.all([
    addVoyagerBonusMonth(admin, referrerProfile.user_id),
    addVoyagerBonusMonth(admin, referredUserId),
  ]);

  return {
    applied: true,
    referrerUserId: referrerProfile.user_id,
    referrerBonusUntil,
    referredBonusUntil,
  };
}
