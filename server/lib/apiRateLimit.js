/** Shared in-memory IP rate limits for public API routes. */

const HOUR_MS = 60 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

const BUCKETS = {
  proxy: { hourMax: 120, burstMax: 25, burstWindowMs: TEN_MIN_MS },
  otp_send: { hourMax: 15, burstMax: 5, burstWindowMs: TEN_MIN_MS },
  otp_verify: { hourMax: 40, burstMax: 12, burstWindowMs: TEN_MIN_MS },
  collaboration: { hourMax: 80, burstMax: 20, burstWindowMs: TEN_MIN_MS },
  token_write: { hourMax: 60, burstMax: 15, burstWindowMs: TEN_MIN_MS },
  claude: { hourMax: 30, burstMax: 8, burstWindowMs: TEN_MIN_MS },
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

export { getClientIp } from "./planTripRateLimit.js";

/**
 * @returns {{ ok: true } | { ok: false, retryAfter: string }}
 */
export function checkApiRateLimit(bucket, ip, now = Date.now()) {
  const limits = BUCKETS[bucket] || BUCKETS.proxy;
  const ipKey = `api:${bucket}:ip:${ip || "unknown"}`;

  const burstCount = countInWindow(`${ipKey}:burst`, limits.burstWindowMs, now);
  if (burstCount >= limits.burstMax) {
    const oldest = (hitLog.get(`${ipKey}:burst`) || [])[0] || now;
    return { ok: false, retryAfter: retryAfterIso(oldest + limits.burstWindowMs) };
  }

  const hourCount = countInWindow(ipKey, HOUR_MS, now);
  if (hourCount >= limits.hourMax) {
    const oldest = (hitLog.get(ipKey) || [])[0] || now;
    return { ok: false, retryAfter: retryAfterIso(oldest + HOUR_MS) };
  }

  return { ok: true };
}

export function recordApiRateLimitHit(bucket, ip, now = Date.now()) {
  const limits = BUCKETS[bucket] || BUCKETS.proxy;
  const ipKey = `api:${bucket}:ip:${ip || "unknown"}`;
  recordHit(ipKey, now);
  recordHit(`${ipKey}:burst`, now);
  return limits;
}
