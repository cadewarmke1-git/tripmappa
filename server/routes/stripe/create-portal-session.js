import { getSupabaseAdmin } from "../../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../../lib/authFromRequest.js";
import {
  getStripe,
  stripeNotConfiguredResponse,
  respondStripeError,
} from "../../lib/stripe.js";
import {
  createBillingPortalSession,
  verifyProfileOwnsCustomer,
} from "../../lib/stripeBilling.js";

/** POST /api/stripe/create-portal-session — Stripe Customer Portal for subscription management. */
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

  const { customerId } = req.body || {};
  if (!customerId || typeof customerId !== "string") {
    return res.status(400).json({ error: "Customer id is required" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const owns = await verifyProfileOwnsCustomer(admin, authUser.id, customerId);
    if (!owns) {
      return res.status(403).json({ error: "Customer id does not match your account" });
    }

    const session = await createBillingPortalSession(stripe, customerId);
    if (!session.url) {
      return res.status(500).json({ error: "Could not open billing portal" });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return respondStripeError(res, err, "create-portal-session");
  }
}
