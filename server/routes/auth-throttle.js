/** POST /api/auth-throttle — app-level email auth rate limit before Supabase Auth calls. */
import { requireTripMappaClient } from "../lib/planTripGuard.js";
import {
  checkAuthRateLimit,
  getClientIp,
  isAuthHoneypotTripped,
  isValidAuthEmail,
  normalizeAuthEmail,
  recordAuthRateLimitHit,
} from "../lib/authRateLimit.js";

const ACTIONS = new Set(["signin", "signup", "recover"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (requireTripMappaClient(req, res)) return undefined;

  const body = req.body || {};
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const email = normalizeAuthEmail(body.email);

  if (!ACTIONS.has(action)) {
    return res.status(400).json({ error: "Invalid action", code: "invalid_action" });
  }
  if (!isValidAuthEmail(email)) {
    return res.status(400).json({ error: "Valid email is required", code: "invalid_email" });
  }

  const ip = getClientIp(req);

  // Honeypot filled → treat as bot: consume budget and reject without hitting Auth.
  if (isAuthHoneypotTripped(body.honeypot)) {
    recordAuthRateLimitHit({ action, email, ip });
    return res.status(429).json({
      error: "Too many attempts. Please wait a moment and try again.",
      code: "rate_limited",
      rateLimited: true,
    });
  }

  const check = checkAuthRateLimit({ action, email, ip });
  if (!check.ok) {
    return res.status(429).json({
      error: "Too many attempts. Please wait a moment and try again.",
      code: "rate_limited",
      rateLimited: true,
      retryAfter: check.retryAfter,
    });
  }

  recordAuthRateLimitHit({ action, email, ip });
  return res.status(200).json({ ok: true });
}
