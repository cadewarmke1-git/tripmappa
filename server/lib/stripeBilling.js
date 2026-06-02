/** Stripe customer, checkout, portal, and webhook profile updates. */
import {
  getStripe,
  PREMIUM_PRICE_CENTS,
  PREMIUM_PRODUCT_NAME,
  getSiteOrigin,
} from "./stripe.js";

export async function ensureStripeCustomer(stripe, admin, userId, email) {
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("stripe_customer_id, tier")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (profile?.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!customer.deleted) {
        if (email && customer.email !== email) {
          await stripe.customers.update(customer.id, { email });
        }
        return customer.id;
      }
    } catch (err) {
      if (err?.code !== "resource_missing") throw err;
    }
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { supabase_user_id: userId },
  });

  const { error: updateErr } = await admin
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
        tier: profile?.tier || "wanderer",
      },
      { onConflict: "user_id" },
    );

  if (updateErr) throw updateErr;
  return customer.id;
}

export async function createPremiumCheckoutSession(stripe, { customerId, userId }) {
  const origin = getSiteOrigin();
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    client_reference_id: userId,
    metadata: { supabase_user_id: userId },
    subscription_data: {
      metadata: { supabase_user_id: userId },
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: PREMIUM_PRICE_CENTS,
          recurring: { interval: "month" },
          product_data: { name: PREMIUM_PRODUCT_NAME },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}?success=1`,
    cancel_url: origin,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    ...(process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION
      ? { payment_method_configuration: process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION }
      : {}),
  });
}

export async function createBillingPortalSession(stripe, customerId) {
  const origin = getSiteOrigin();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: origin,
  });
}

export async function applyPremiumFromCheckout(admin, stripe, session) {
  const userId =
    session.metadata?.supabase_user_id ||
    session.client_reference_id ||
    null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!userId) {
    console.warn("stripe webhook: checkout.session.completed missing user id");
    return;
  }

  let renewalAt = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (sub.current_period_end) {
        renewalAt = new Date(sub.current_period_end * 1000).toISOString();
      }
    } catch (err) {
      console.warn("stripe webhook: could not load subscription for renewal date", err.message);
    }
  }

  const patch = {
    user_id: userId,
    tier: "trailblazer",
    stripe_customer_id: customerId || undefined,
    stripe_subscription_id: subscriptionId || undefined,
    premium_renewal_at: renewalAt,
    trailblazer_trial_ends_at: null,
    show_trial_ended_prompt: false,
  };

  const { error } = await admin.from("user_profiles").upsert(patch, { onConflict: "user_id" });
  if (error) throw error;
}

export async function downgradeUserToFree(admin, subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    console.warn("stripe webhook: subscription.deleted missing customer id");
    return;
  }

  const { data: profiles, error: findErr } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .limit(1);

  if (findErr) throw findErr;
  const profile = profiles?.[0];
  if (!profile) {
    console.warn("stripe webhook: no profile for customer", customerId);
    return;
  }

  const { error } = await admin
    .from("user_profiles")
    .update({
      tier: "wanderer",
      stripe_subscription_id: null,
      premium_renewal_at: null,
    })
    .eq("user_id", profile.user_id);

  if (error) throw error;
}

export async function verifyProfileOwnsCustomer(admin, userId, customerId) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.stripe_customer_id === customerId;
}

export function getStripeOrThrow() {
  const stripe = getStripe();
  if (!stripe) {
    const err = new Error("Stripe not configured");
    err.code = "stripe_not_configured";
    throw err;
  }
  return stripe;
}
