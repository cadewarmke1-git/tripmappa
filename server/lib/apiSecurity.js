/** Shared API security helpers — client guard, rate limits, input validation. */

import { requireTripMappaClient } from "./planTripGuard.js";
import { checkApiRateLimit, recordApiRateLimitHit, getClientIp } from "./apiRateLimit.js";

export const PLAN_TRIP_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
]);

export const CLAUDE_PROXY_MODELS = new Set([
  "claude-haiku-4-5-20251001",
]);

export const PROMPT_FIELD_MAX = 8000;
export const MAX_FOLLOWER_PHONES = 20;

export function clampString(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen);
}

export function resolveAllowedModel(requested, defaultModel, allowed) {
  const candidate = String(requested || defaultModel).slice(0, 80);
  return allowed.has(candidate) ? candidate : defaultModel;
}

export function isValidShareToken(token) {
  return typeof token === "string"
    && token.length >= 16
    && token.length <= 64
    && /^[A-Za-z0-9_-]+$/.test(token);
}

export function isValidInviteToken(token) {
  return typeof token === "string"
    && token.length >= 24
    && token.length <= 48
    && /^[a-f0-9]+$/.test(token);
}

export function isValidItineraryShareId(id) {
  return typeof id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function sendGenericServerError(res, status = 500) {
  return res.status(status).json({ error: "Internal server error" });
}

export function rejectRateLimited(res, retryAfter) {
  return res.status(429).json({
    error: "Rate limit exceeded",
    rateLimited: true,
    retryAfter,
  });
}

/** Require TripMappa web client header + IP rate limit. Returns true when rejected. */
export function guardProxyRoute(req, res, bucket = "proxy") {
  if (requireTripMappaClient(req, res)) return true;
  const ip = getClientIp(req);
  const check = checkApiRateLimit(bucket, ip);
  if (!check.ok) {
    rejectRateLimited(res, check.retryAfter);
    return true;
  }
  recordApiRateLimitHit(bucket, ip);
  return false;
}

/** IP rate limit for token-gated write endpoints. Returns true when rejected. */
export function guardTokenWriteRoute(req, res, bucket = "token_write") {
  const ip = getClientIp(req);
  const check = checkApiRateLimit(bucket, ip);
  if (!check.ok) {
    rejectRateLimited(res, check.retryAfter);
    return true;
  }
  recordApiRateLimitHit(bucket, ip);
  return false;
}
