import { describe, expect, it } from "vitest";
import {
  buildGenerationStreamProgress,
  buildClientCreditSnapshot,
  decrementCachedCreditStatus,
} from "./planTripStream.js";

describe("planTripStream client helpers", () => {
  it("extracts route summary and stop names from partial JSON", () => {
    const progress = buildGenerationStreamProgress(
      '{"route_summary":"Dallas to Austin day trip","road_stops":[{"name":"Buc-ee\'s","city":"Temple, TX"}]}',
    );
    expect(progress.phase).toBe("stops");
    expect(progress.routeSummary).toContain("Dallas");
    expect(progress.stopNames).toContain("Buc-ee's");
    expect(progress.cityNames).toContain("Temple, TX");
    expect(progress.message).toMatch(/Buc-ee/i);
  });

  it("builds client credit snapshot from status", () => {
    const snap = buildClientCreditSnapshot({
      tier: "voyager",
      remaining: 12,
      unlimited: false,
      billingPeriod: "monthly",
      resetDate: "2099-02-01",
      used: 8,
      limit: 20,
      monthlyUsed: 8,
    });
    expect(snap.monthly_generation_count).toBe(8);
    expect(snap.monthly_generation_reset_date).toBe("2099-02-01");
  });

  it("decrements cached monthly credits optimistically", () => {
    const next = decrementCachedCreditStatus({
      tier: "voyager",
      remaining: 3,
      used: 17,
      unlimited: false,
      billingPeriod: "monthly",
      monthlyUsed: 17,
    });
    expect(next.remaining).toBe(2);
    expect(next.monthlyUsed).toBe(18);
  });
});
