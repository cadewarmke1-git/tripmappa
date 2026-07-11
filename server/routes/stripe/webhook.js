import { getSupabaseAdmin } from "../../lib/supabaseAdmin.js";
import { captureServerException } from "../../lib/sentry.js";
import { readRawBody } from "../../lib/readRawBody.js";
import { getStripe, stripeNotConfiguredResponse } from "../../lib/stripe.js";
import {
  applyPremiumFromCheckout,
  applySubscriptionRenewal,
  downgradeUserToFree,
} from "../../lib/stripeBilling.js";

/** POST /api/stripe/webhook — Stripe billing events (raw body + signature). */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return stripeNotConfiguredResponse(res);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ error: "Missing webhook signature" });
  }

  let event;
  try {
    let rawBody = await readRawBody(req);
    if (!rawBody.length && req.body && typeof req.body === "object") {
      rawBody = Buffer.from(JSON.stringify(req.body), "utf8");
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("stripe webhook signature:", err.message);
    captureServerException(err);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  try {
    const { data: existingEvent } = await admin
      .from("stripe_webhook_events")
      .select("event_id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const { error: insertErr } = await admin
      .from("stripe_webhook_events")
      .insert({ event_id: event.id });
    if (insertErr) {
      if (insertErr.code === "23505") {
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw insertErr;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription") {
          await applyPremiumFromCheckout(admin, stripe, session);
          const userId =
            session.metadata?.supabase_user_id || session.client_reference_id;
          if (userId) {
            const { sendPlanWelcomeEmail } = await import("../../lib/email/planWelcome.js");
            const { data: profile } = await admin
              .from("user_profiles")
              .select("premium_renewal_at, tier")
              .eq("user_id", userId)
              .maybeSingle();
            const planKey = profile?.tier === "voyager" ? "voyager" : "trailblazer";
            await sendPlanWelcomeEmail(admin, userId, planKey, profile?.premium_renewal_at);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        await downgradeUserToFree(admin, event.data.object);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const prev = event.data.previous_attributes;
        const periodRenewed = prev?.current_period_start != null
          && subscription.current_period_start !== prev.current_period_start;
        if (periodRenewed) {
          await applySubscriptionRenewal(admin, stripe, subscription);
        }
        break;
      }
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("stripe webhook handler:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
