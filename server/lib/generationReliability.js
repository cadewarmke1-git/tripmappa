/** Plan-trip generation reliability — structured logs + Sentry metrics (never blocks generation). */

import { Sentry, initServerSentry } from "./sentry.js";

export const PLAN_TRIP_RELIABILITY_EVENT = "plan_trip_reliability";

/**
 * Summarize a batch of reliability payloads (for tests / offline p95 from log export).
 * @param {Array<{ outcome: string, latency_ms: number, corridor_fallback?: boolean, empty_response?: boolean }>} samples
 */
export function summarizeReliabilitySamples(samples = []) {
  const n = samples.length;
  if (!n) {
    return {
      n: 0,
      success_rate: 0,
      p95_latency_ms: null,
      corridor_fallback_rate: 0,
      empty_response_rate: 0,
    };
  }
  const successes = samples.filter((s) => s.outcome === "success").length;
  const latencies = samples
    .map((s) => Number(s.latency_ms))
    .filter((ms) => Number.isFinite(ms) && ms >= 0)
    .sort((a, b) => a - b);
  const corridor = samples.filter((s) => s.corridor_fallback).length;
  const empty = samples.filter((s) => s.empty_response).length;
  return {
    n,
    success_rate: successes / n,
    p95_latency_ms: percentile(latencies, 0.95),
    corridor_fallback_rate: corridor / n,
    empty_response_rate: empty / n,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

function emitSentryReliability(payload) {
  try {
    initServerSentry();
    const attrs = {
      outcome: payload.outcome,
      code: String(payload.code || "unknown"),
      corridor_fallback: payload.corridor_fallback ? "true" : "false",
      empty_response: payload.empty_response ? "true" : "false",
    };

    if (typeof Sentry.metrics?.count === "function") {
      Sentry.metrics.count("plan_trip.requests", 1, { attributes: attrs });
      Sentry.metrics.count(
        payload.outcome === "success" ? "plan_trip.success" : "plan_trip.error",
        1,
        { attributes: attrs },
      );
      if (payload.corridor_fallback) {
        Sentry.metrics.count("plan_trip.corridor_fallback", 1, { attributes: attrs });
      }
      if (payload.empty_response) {
        Sentry.metrics.count("plan_trip.empty_response", 1, { attributes: attrs });
      }
      if (typeof Sentry.metrics.distribution === "function") {
        Sentry.metrics.distribution("plan_trip.latency_ms", payload.latency_ms, {
          attributes: attrs,
          unit: "millisecond",
        });
      }
      return;
    }

    Sentry.addBreadcrumb({
      category: PLAN_TRIP_RELIABILITY_EVENT,
      level: payload.outcome === "success" ? "info" : "warning",
      data: payload,
    });
  } catch {
    // never block generation
  }
}

/**
 * Track one plan-trip generation attempt (start after credits pass, before SSE/LLM).
 * Emits Vercel-queryable logs: console.info("[plan_trip_reliability]", JSON)
 * and Sentry metrics: plan_trip.success / .error / .latency_ms / .corridor_fallback / .empty_response
 */
export function createPlanTripReliabilityTracker({ userId = null, startedAt = Date.now() } = {}) {
  let corridorFallback = false;
  let finished = false;

  return {
    setCorridorFallback(flag) {
      corridorFallback = Boolean(flag);
    },
    getCorridorFallback() {
      return corridorFallback;
    },
    /**
     * @param {{ outcome: 'success'|'error', code?: string, emptyResponse?: boolean }} result
     */
    finish(result = {}) {
      if (finished) return null;
      finished = true;
      const outcome = result.outcome === "success" ? "success" : "error";
      const code = result.code || (outcome === "success" ? "complete" : "unknown");
      const emptyResponse = Boolean(result.emptyResponse) || code === "incomplete_response";
      const payload = {
        event: PLAN_TRIP_RELIABILITY_EVENT,
        outcome,
        code,
        latency_ms: Math.max(0, Date.now() - startedAt),
        corridor_fallback: corridorFallback,
        empty_response: emptyResponse,
        user_id: userId || null,
        ts: new Date().toISOString(),
      };
      console.info(`[${PLAN_TRIP_RELIABILITY_EVENT}]`, JSON.stringify(payload));
      emitSentryReliability(payload);
      return payload;
    },
  };
}
