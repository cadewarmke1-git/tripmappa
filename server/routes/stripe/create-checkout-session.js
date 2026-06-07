import { getSupabaseAdmin } from "../../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../../lib/authFromRequest.js";
import {
  getStripe,
  stripeNotConfiguredResponse,
  respondStripeError,
} from "../../lib/stripe.js";
import {
  ensureStripeCustomer,
  createPremiumCheckoutSession,
} from "../../lib/stripeBilling.js";

/** POST /api/stripe/create-checkout-session — Stripe Checkout for TripMappa Premium. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripe();
  if (!stripe) return stripeNotConfiguredResponse(res);

  const authUser = await getUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { userId, email, billingInterval = "month" } = req.body || {};
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "User id is required" });
  }
  if (userId !== authUser.id) {
    return res.status(403).json({ error: "User id does not match session" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const checkoutEmail =
    (typeof email === "string" && email.trim()) || authUser.email || undefined;

  try {
    const customerId = await ensureStripeCustomer(
      stripe,
      admin,
      userId,
      checkoutEmail,
    );
    const session = await createPremiumCheckoutSession(stripe, {
      customerId,
      userId,
      billingInterval: billingInterval === "year" ? "year" : "month",
    });

    if (!session.url) {
      return res.status(500).json({ error: "Could not start checkout" });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    if (err.code === "stripe_not_configured") {
      return stripeNotConfiguredResponse(res);
    }
    return respondStripeError(res, err, "create-checkout-session");
  }
}
