/** Welcome email after paid plan upgrade (Voyager or Trailblazer). */
import { sendTripmappaEmail, getUserEmail } from "./sendEmail.js";
import { welcomePlanEmail } from "./templates.js";
import { formatEmailDate } from "../trials.js";

const PLAN_BENEFITS = {
  voyager: [
    "Unlimited Trip Generations",
    "Live location sharing",
    "Offline maps",
  ],
  trailblazer: [
    "Everything in Voyager",
    "Grocery delivery to your hotel",
    "Priority generation queue",
    "Voice-to-list grocery ordering",
  ],
};

const PLAN_LABELS = {
  voyager: "Voyager",
  trailblazer: "Trailblazer",
};

export async function sendPlanWelcomeEmail(admin, userId, planKey, billingDateIso) {
  const normalized = planKey === "voyager" ? "voyager" : "trailblazer";
  const email = await getUserEmail(admin, userId);
  if (!email) return { sent: false, skipped: true };

  const planName = PLAN_LABELS[normalized];
  const benefits = PLAN_BENEFITS[normalized];
  const billingDate = billingDateIso
    ? formatEmailDate(billingDateIso)
    : "your next billing cycle";

  const { subject, html, text } = welcomePlanEmail({ planName, benefits, billingDate });
  return sendTripmappaEmail({ to: email, subject, html, text });
}
