/** Founding 250 program — Voyager access free for three months + permanent badge. */
import { buildUserProfileUpsertRow } from "./userProfileDefaults.js";

export const FOUNDING_MEMBER_MAX = 250;
/** Free Voyager-equivalent access duration after claim. */
export const FOUNDING_BENEFIT_MONTHS = 3;

const PAID_TIERS = new Set(["voyager", "trailblazer", "premium", "traveler"]);

/**
 * Founder-owned / internal emails that may hold founding_members rows but do not
 * consume the public 250-spot allotment (remaining counter + capacity check).
 */
const FOUNDER_OWNED_SLOT_EMAILS = new Set([
  "cadewarmke@gmail.com",
  "cadewarmke1@gmail.com",
  "tripmappa@gmail.com",
]);

/** UUID v4 (Supabase auth user IDs). */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseExemptUserIds() {
  const raw = (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const valid = [];
  for (const id of raw) {
    if (UUID_V4_REGEX.test(id)) {
      valid.push(id);
    } else {
      console.warn(
        `[foundingMembers] ADMIN_USER_IDS entry is not a valid UUID v4 and was ignored: "${id}"`,
      );
    }
  }
  return valid;
}

/** Supabase user IDs that skip Founder slot claim but receive permanent Trailblazer (ADMIN_USER_IDS). */
export const EXEMPT_USER_IDS = parseExemptUserIds();

export function isExemptFounderUser(userId) {
  return Boolean(userId && EXEMPT_USER_IDS.includes(userId));
}

export function isFounderOwnedSlotEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  if (FOUNDER_OWNED_SLOT_EMAILS.has(e)) return true;
  if (e.endsWith("@tripmappa.test")) return true;
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (adminEmail && e === adminEmail) return true;
  return false;
}

function hasPermanentAdminTrailblazer(profile) {
  return (
    profile?.tier === "trailblazer"
    && !profile?.stripe_subscription_id
    && !profile?.founder_expires_at
  );
}

function logExemptGrant(userId) {
  console.log(
    `[foundingMembers] Admin exempt Trailblazer grant applied (user …${userId.slice(-4)})`,
  );
}

async function grantPermanentTrailblazer(admin, userId) {
  const { error } = await admin.from("user_profiles").upsert(
    buildUserProfileUpsertRow(userId, {
      tier: "trailblazer",
      founder_expires_at: null,
      trailblazer_trial_ends_at: null,
      show_trial_ended_prompt: false,
    }),
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function countFoundingMembers(admin) {
  const { count, error } = await admin
    .from("founding_members")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * Public Founder allotment used for remaining spots + "full" checks.
 * Keeps founder-owned / smoke / admin rows in founding_members but does not
 * subtract them from the 250 public spots.
 */
export async function countPublicFoundingMembers(admin) {
  const { data: rows, error } = await admin
    .from("founding_members")
    .select("user_id");
  if (error) throw error;
  if (!rows?.length) return 0;

  const flags = await Promise.all(
    rows.map(async (row) => {
      const { data, error: userErr } = await admin.auth.admin.getUserById(row.user_id);
      if (userErr) {
        // Unknown user — count toward public allotment so we never over-claim.
        return true;
      }
      return !isFounderOwnedSlotEmail(data?.user?.email);
    }),
  );
  return flags.filter(Boolean).length;
}

export async function isFoundingMember(admin, userId) {
  const { data, error } = await admin
    .from("founding_members")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function threeMonthsFromNow(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + FOUNDING_BENEFIT_MONTHS);
  return d.toISOString();
}

/** After founder Voyager window ends: keep Stripe tier if subscribed, otherwise Wanderer. Badge stays via founding_members. */
export async function expireFounderIfNeeded(admin, profile) {
  if (!profile || profile.tier !== "founder") return profile;

  const expiresAt = profile.founder_expires_at
    ? new Date(profile.founder_expires_at)
    : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt > new Date()) {
    return profile;
  }

  const nextTier = profile.stripe_subscription_id ? "trailblazer" : "wanderer";
  const patch = {
    tier: nextTier,
    founder_expires_at: null,
  };

  const { data, error } = await admin
    .from("user_profiles")
    .update(patch)
    .eq("user_id", profile.user_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Claim a founding slot for a new user when slots remain.
 * Does not override existing paid tiers.
 */
export async function tryClaimFoundingSlot(admin, userId) {
  if (isExemptFounderUser(userId)) {
    const { data: profile, error: profileErr } = await admin
      .from("user_profiles")
      .select("tier, stripe_subscription_id, founder_expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr) throw profileErr;

    if (hasPermanentAdminTrailblazer(profile)) {
      return { claimed: true, already: true };
    }

    await grantPermanentTrailblazer(admin, userId);
    logExemptGrant(userId);
    return { claimed: true };
  }

  if (await isFoundingMember(admin, userId)) {
    return { claimed: true, already: true };
  }

  const publicFilled = await countPublicFoundingMembers(admin);
  if (publicFilled >= FOUNDING_MEMBER_MAX) {
    return { claimed: false, reason: "full" };
  }

  const { data: profile, error: profileErr } = await admin
    .from("user_profiles")
    .select("tier, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileErr) throw profileErr;

  if (profile?.stripe_subscription_id || PAID_TIERS.has(profile?.tier)) {
    return { claimed: false, reason: "paid_tier" };
  }

  // slot_number is unique table-wide (includes founder-owned rows).
  const totalFilled = await countFoundingMembers(admin);
  const slotNumber = totalFilled + 1;
  const founderExpiresAt = threeMonthsFromNow();

  const { error: insertErr } = await admin.from("founding_members").insert({
    user_id: userId,
    slot_number: slotNumber,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { claimed: true, already: true };
    }
    throw insertErr;
  }

  const { error: updateErr } = await admin.from("user_profiles").upsert(
    buildUserProfileUpsertRow(userId, {
      tier: "founder",
      founder_expires_at: founderExpiresAt,
    }),
    { onConflict: "user_id" },
  );

  if (updateErr) throw updateErr;

  // Once per user: only this fresh-claim path sends; already/full/paid/exempt skip it.
  let welcomeEmail = null;
  try {
    const { sendFounderWelcomeEmail } = await import("./email/founderWelcome.js");
    const sendResult = await sendFounderWelcomeEmail(admin, userId, { founderExpiresAt });
    // Do not leak Resend ids / from / recipient / raw provider payload to the client.
    welcomeEmail = {
      sent: Boolean(sendResult?.sent),
      skipped: Boolean(sendResult?.skipped),
      personalized: Boolean(sendResult?.personalized),
      firstName: sendResult?.firstName || null,
      error: sendResult?.error || null,
    };
  } catch (err) {
    console.error("[foundingMembers] Founder welcome email failed:", err);
    welcomeEmail = { sent: false, error: "exception" };
  }

  return { claimed: true, slotNumber, founderExpiresAt, welcomeEmail };
}
