/** Welcome email after a successful Founder slot claim (not paid Stripe upgrade). */
import { sendTripmappaEmail, getUserEmail } from "./sendEmail.js";
import { welcomeFounderEmail } from "./templates.js";
import { formatEmailDate } from "../trials.js";

/**
 * Send the Founder onboarding email once after a fresh claim.
 * Callers must invoke this only on successful new claims (not already / full / paid).
 */
export async function sendFounderWelcomeEmail(admin, userId, { founderExpiresAt } = {}) {
  const email = await getUserEmail(admin, userId);
  if (!email) return { sent: false, skipped: true };

  const expiresLabel = founderExpiresAt ? formatEmailDate(founderExpiresAt) : null;
  const { subject, html, text } = welcomeFounderEmail({ expiresLabel });
  return sendTripmappaEmail({ to: email, subject, html, text });
}
