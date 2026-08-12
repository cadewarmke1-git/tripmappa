/** Welcome email after a successful Founder slot claim (not paid Stripe upgrade). */
import { sendTripmappaEmail, getUserEmail } from "./sendEmail.js";
import { welcomeFounderEmail } from "./templates.js";
import { formatEmailDate } from "../trials.js";

function firstNameToken(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/).filter(Boolean)[0] || "";
}

/**
 * Resolve a real first name for the Founder email heading.
 * Prefers user_profiles.display_name, then auth metadata full_name/name.
 * Does not use email local-part — empty means heading falls back to "Welcome".
 *
 * At claim time (right after email/password signup) display_name is often unset;
 * OAuth or later profile edits may already have a name.
 */
export async function resolveFounderFirstName(admin, userId) {
  if (!admin || !userId) return "";

  try {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const fromProfile = firstNameToken(profile?.display_name);
    if (fromProfile) return fromProfile;
  } catch {
    /* profile optional */
  }

  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) return "";
    const meta = data?.user?.user_metadata || {};
    return firstNameToken(meta.full_name || meta.name || meta.display_name);
  } catch {
    return "";
  }
}

/**
 * Send the Founder onboarding email once after a fresh claim.
 * Callers must invoke this only on successful new claims (not already / full / paid).
 */
export async function sendFounderWelcomeEmail(admin, userId, { founderExpiresAt } = {}) {
  const email = await getUserEmail(admin, userId);
  if (!email) return { sent: false, skipped: true, reason: "missing_recipient", to: null };

  const firstName = await resolveFounderFirstName(admin, userId);
  const expiresLabel = founderExpiresAt ? formatEmailDate(founderExpiresAt) : null;
  const { subject, html, text } = welcomeFounderEmail({ firstName, expiresLabel });
  const sendResult = await sendTripmappaEmail({ to: email, subject, html, text });

  return {
    ...sendResult,
    to: email,
    subject,
    firstName: firstName || null,
    personalized: Boolean(firstName),
  };
}
