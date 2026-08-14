/** Client helper — call /api/auth-throttle before Supabase email auth. */
import { tripMappaApiHeaders } from "./tripmappaHeaders.js";

/**
 * @param {'signin'|'signup'|'recover'} action
 * @param {string} email
 * @param {{ honeypot?: string }} [opts]
 */
export async function assertEmailAuthThrottle(action, email, opts = {}) {
  const response = await fetch("/api/auth-throttle", {
    method: "POST",
    headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      action,
      email: String(email || "").trim(),
      honeypot: opts.honeypot || "",
    }),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 429 || data.rateLimited) {
    const err = new Error(data.error || "Too many attempts. Please wait a moment and try again.");
    err.code = "rate_limited";
    err.rateLimited = true;
    err.retryAfter = data.retryAfter;
    throw err;
  }

  if (!response.ok) {
    throw new Error(data.error || "Could not verify sign-in attempt");
  }

  return data;
}
