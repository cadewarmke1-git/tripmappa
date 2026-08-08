import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createPlanTripReliabilityTracker,
  summarizeReliabilitySamples,
  PLAN_TRIP_RELIABILITY_EVENT,
} from "./generationReliability.js";

describe("generationReliability", () => {
  let infoSpy;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it("logs structured reliability payload once on finish", () => {
    const tracker = createPlanTripReliabilityTracker({ userId: "u1", startedAt: Date.now() - 1200 });
    tracker.setCorridorFallback(true);
    const payload = tracker.finish({ outcome: "success", code: "complete" });
    expect(payload.event).toBe(PLAN_TRIP_RELIABILITY_EVENT);
    expect(payload.outcome).toBe("success");
    expect(payload.corridor_fallback).toBe(true);
    expect(payload.empty_response).toBe(false);
    expect(payload.latency_ms).toBeGreaterThanOrEqual(1000);
    expect(payload.user_id).toBe("u1");
    expect(infoSpy).toHaveBeenCalledWith(
      `[${PLAN_TRIP_RELIABILITY_EVENT}]`,
      expect.stringContaining('"outcome":"success"'),
    );
    expect(tracker.finish({ outcome: "error" })).toBeNull();
  });

  it("flags incomplete_response as empty_response", () => {
    const tracker = createPlanTripReliabilityTracker({ startedAt: Date.now() });
    const payload = tracker.finish({ outcome: "error", code: "incomplete_response" });
    expect(payload.empty_response).toBe(true);
  });

  it("summarizeReliabilitySamples computes success rate, p95, and fallback rates", () => {
    const summary = summarizeReliabilitySamples([
      { outcome: "success", latency_ms: 100, corridor_fallback: false, empty_response: false },
      { outcome: "success", latency_ms: 200, corridor_fallback: true, empty_response: false },
      { outcome: "error", latency_ms: 300, corridor_fallback: false, empty_response: true },
      { outcome: "success", latency_ms: 400, corridor_fallback: false, empty_response: false },
      { outcome: "success", latency_ms: 1000, corridor_fallback: true, empty_response: false },
    ]);
    expect(summary.n).toBe(5);
    expect(summary.success_rate).toBe(0.8);
    expect(summary.corridor_fallback_rate).toBe(0.4);
    expect(summary.empty_response_rate).toBe(0.2);
    expect(summary.p95_latency_ms).toBe(1000);
  });
});
