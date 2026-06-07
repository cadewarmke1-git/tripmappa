/** In-memory rate limits for /api/plan-trip — no external dependencies. */

const HOUR_MS = 60 * 60 * 1000;
const TEN_MIN_MS = 10 * 60 * 1000;

const USER_HOURLY_MAX = 5;
const IP_HOURLY_MAX = 10;
const IP_BURST_MAX = 3;
const IP_BURST_WINDOW_MS = TEN_MIN_MS;

/** @type {Map<string, number[]>} */
const hitLog = new Map();

function pruneTimestamps(timestamps, windowMs, now = Date.now()) {
  const cutoff = now - windowMs;
  return timestamps.filter(t => t >= cutoff);
}

function recordHit(key, now = Date.now()) {
  const prev = hitLog.get(key) || [];
  const next = [...prev, now];
  hitLog.set(key, next);
  return next;
}

function countInWindow(key, windowMs, now = Date.now()) {
  const timestamps = pruneTimestamps(hitLog.get(key) || [], windowMs, now);
  hitLog.set(key, timestamps);
  return timestamps.length;
}

function retryAfterIso(fromMs) {
  return new Date(fromMs).toISOString();
}

/**
 * @returns {{ ok: true } | { ok: false, limitType: 'user' | 'ip' | 'ip_burst', retryAfter: string }}
 */
export function checkPlanTripRateLimit({ userId, ip, now = Date.now() }) {
  if (userId) {
    const userKey = `user:${userId}`;
    const userCount = countInWindow(userKey, HOUR_MS, now);
    if (userCount >= USER_HOURLY_MAX) {
      const oldest = (hitLog.get(userKey) || [])[0] || now;
      return {
        ok: false,
        limitType: "user",
        retryAfter: retryAfterIso(oldest + HOUR_MS),
      };
    }
  }

  const ipKey = `ip:${ip || "unknown"}`;
  const burstCount = countInWindow(`${ipKey}:burst`, IP_BURST_WINDOW_MS, now);
  if (burstCount >= IP_BURST_MAX) {
    const oldest = (hitLog.get(`${ipKey}:burst`) || [])[0] || now;
    return {
      ok: false,
      limitType: "ip_burst",
      retryAfter: retryAfterIso(oldest + IP_BURST_WINDOW_MS),
    };
  }

  const ipHourCount = countInWindow(ipKey, HOUR_MS, now);
  if (ipHourCount >= IP_HOURLY_MAX) {
    const oldest = (hitLog.get(ipKey) || [])[0] || now;
    return {
      ok: false,
      limitType: "ip",
      retryAfter: retryAfterIso(oldest + HOUR_MS),
    };
  }

  return { ok: true };
}

/** Record a successful pass through rate limit checks (not called on 429). */
export function recordPlanTripRateLimitHit({ userId, ip, now = Date.now() }) {
  if (userId) recordHit(`user:${userId}`, now);
  const ipKey = `ip:${ip || "unknown"}`;
  recordHit(ipKey, now);
  recordHit(`${ipKey}:burst`, now);
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"] || req.headers["x-real-ip"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
