/** In-memory email + IP rate limits for auth (sign-in / sign-up / password reset). */

import crypto from "crypto";
import { getClientIp } from "./planTripRateLimit.js";

const HOUR_MS = 60 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

const LIMITS = {
  signin: { hourMax: 20, burstMax: 8, burstWindowMs: TEN_MIN_MS, emailHourMax: 12, emailBurstMax: 5 },
  signup: { hourMax: 12, burstMax: 5, burstWindowMs: TEN_MIN_MS, emailHourMax: 6, emailBurstMax: 3 },
  recover: { hourMax: 10, burstMax: 4, burstWindowMs: TEN_MIN_MS, emailHourMax: 5, emailBurstMax: 2 },
};

/** @type {Map<string, number[]>} */
const hitLog = new Map();

function pruneTimestamps(timestamps, windowMs, now = Date.now()) {
  const cutoff = now - windowMs;
  return timestamps.filter(t => t >= cutoff);
}

function recordHit(key, now = Date.now()) {
  const prev = hitLog.get(key) || [];
  hitLog.set(key, [...prev, now]);
}

function countInWindow(key, windowMs, now = Date.now()) {
  const timestamps = pruneTimestamps(hitLog.get(key) || [], windowMs, now);
  hitLog.set(key, timestamps);
  return timestamps.length;
}

function retryAfterIso(fromMs) {
  return new Date(fromMs).toISOString();
}

export function normalizeAuthEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidAuthEmail(email) {
  const value = normalizeAuthEmail(email);
  return value.length >= 5 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function hashAuthEmail(email) {
  return crypto.createHash("sha256").update(normalizeAuthEmail(email)).digest("hex").slice(0, 32);
}

export function isAuthHoneypotTripped(honeypot) {
  return typeof honeypot === "string" && honeypot.trim().length > 0;
}

/**
 * @param {{ action: 'signin'|'signup'|'recover', email: string, ip?: string, now?: number }} args
 * @returns {{ ok: true } | { ok: false, retryAfter: string, reason: string }}
 */
export function checkAuthRateLimit({ action, email, ip, now = Date.now() }) {
  const limits = LIMITS[action] || LIMITS.signin;
  const ipKey = `auth:${action}:ip:${ip || "unknown"}`;
  const emailKey = `auth:${action}:email:${hashAuthEmail(email)}`;

  const ipBurst = countInWindow(`${ipKey}:burst`, limits.burstWindowMs, now);
  if (ipBurst >= limits.burstMax) {
    const oldest = (hitLog.get(`${ipKey}:burst`) || [])[0] || now;
    return { ok: false, retryAfter: retryAfterIso(oldest + limits.burstWindowMs), reason: "ip_burst" };
  }

  const ipHour = countInWindow(ipKey, HOUR_MS, now);
  if (ipHour >= limits.hourMax) {
    const oldest = (hitLog.get(ipKey) || [])[0] || now;
    return { ok: false, retryAfter: retryAfterIso(oldest + HOUR_MS), reason: "ip_hour" };
  }

  const emailBurst = countInWindow(`${emailKey}:burst`, limits.burstWindowMs, now);
  if (emailBurst >= limits.emailBurstMax) {
    const oldest = (hitLog.get(`${emailKey}:burst`) || [])[0] || now;
    return { ok: false, retryAfter: retryAfterIso(oldest + limits.burstWindowMs), reason: "email_burst" };
  }

  const emailHour = countInWindow(emailKey, HOUR_MS, now);
  if (emailHour >= limits.emailHourMax) {
    const oldest = (hitLog.get(emailKey) || [])[0] || now;
    return { ok: false, retryAfter: retryAfterIso(oldest + HOUR_MS), reason: "email_hour" };
  }

  return { ok: true };
}

export function recordAuthRateLimitHit({ action, email, ip, now = Date.now() }) {
  const ipKey = `auth:${action}:ip:${ip || "unknown"}`;
  const emailKey = `auth:${action}:email:${hashAuthEmail(email)}`;
  recordHit(ipKey, now);
  recordHit(`${ipKey}:burst`, now);
  recordHit(emailKey, now);
  recordHit(`${emailKey}:burst`, now);
}

export { getClientIp, LIMITS as AUTH_RATE_LIMITS };
