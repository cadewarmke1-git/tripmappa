/** Stripe SDK singleton and safe API error mapping for clients. */
import Stripe from "stripe";

let stripeClient = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function stripeNotConfiguredResponse(res) {
  return res.status(503).json({ error: "Billing is not configured" });
}

/** Log Stripe errors server-side; return a generic message to the client. */
export function respondStripeError(res, err, logLabel = "stripe") {
  console.error(`${logLabel}:`, err);
  const status = err?.statusCode && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;
  const code = err?.code;
  if (code === "resource_missing") {
    return res.status(404).json({ error: "Billing account not found" });
  }
  if (status === 400) {
    return res.status(400).json({ error: "Invalid billing request" });
  }
  return res.status(500).json({ error: "Billing request failed" });
}

export const PREMIUM_PRICE_CENTS = 799;
export const PREMIUM_PRODUCT_NAME = "TripMappa Trailblazer";

export function getSiteOrigin() {
  const fromEnv = process.env.TRIPMAPPA_SITE_URL || process.env.SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://tripmappa.com";
}
