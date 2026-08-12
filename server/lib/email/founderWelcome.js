/** Welcome email after a successful Founder slot claim (not paid Stripe upgrade). */
import { sendTripmappaEmail, getUserEmail, getResendEmail } from "./sendEmail.js";
import { welcomeFounderEmail } from "./templates.js";
import { formatEmailDate } from "../trials.js";

/**
 * Send the Founder onboarding email once after a fresh claim.
 * Callers must invoke this only on successful new claims (not already / full / paid).
 */
export async function sendFounderWelcomeEmail(admin, userId, { founderExpiresAt } = {}) {
  const email = await getUserEmail(admin, userId);
  if (!email) return { sent: false, skipped: true, reason: "missing_recipient", to: null };

  const expiresLabel = founderExpiresAt ? formatEmailDate(founderExpiresAt) : null;
  const { subject, html, text } = welcomeFounderEmail({ expiresLabel });
  const sendResult = await sendTripmappaEmail({ to: email, subject, html, text });

  let delivery = null;
  if (sendResult?.sent && sendResult?.id) {
    // Brief wait so Resend can attach an initial last_event for diagnostics.
    await new Promise((r) => setTimeout(r, 2500));
    delivery = await getResendEmail(sendResult.id);
  }

  return {
    ...sendResult,
    to: email,
    subject,
    delivery,
    last_event: delivery?.last_event || null,
  };
}
