import { describe, expect, it } from "vitest";
import {
  ensureMonthlyGenerationPrefs,
  getCreditStatus,
  resetMonthlyGenerationAllowance,
  VOYAGER_MONTHLY_LIMIT,
  TRAILBLAZER_MONTHLY_LIMIT,
  FREE_LIFETIME_LIMIT,
} from "../../server/lib/tripCredits.js";

describe("tripCredits monthly limits", () => {
  it("resets monthly count when reset date has passed", () => {
    const prefs = ensureMonthlyGenerationPrefs({
      monthly_generation_count: 18,
      monthly_generation_reset_date: "2020-01-01",
    });
    expect(prefs.monthly_generation_count).toBe(0);
    expect(prefs.monthly_generation_reset_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns voyager monthly remaining", () => {
    const status = getCreditStatus({
      tier: "voyager",
      generations_used: 0,
      plan_preferences: {
        monthly_generation_count: 5,
        monthly_generation_reset_date: "2099-12-01",
      },
    });
    expect(status.remaining).toBe(VOYAGER_MONTHLY_LIMIT - 5);
    expect(status.billingPeriod).toBe("monthly");
  });

  it("returns wanderer lifetime remaining", () => {
    const status = getCreditStatus({
      tier: "wanderer",
      generations_used: 1,
      plan_preferences: {},
    });
    expect(status.remaining).toBe(FREE_LIFETIME_LIMIT - 1);
    expect(status.billingPeriod).toBe("lifetime");
  });

  it("returns trailblazer monthly limit", () => {
    const status = getCreditStatus({
      tier: "trailblazer",
      generations_used: 0,
      plan_preferences: {
        monthly_generation_count: 10,
        monthly_generation_reset_date: "2099-12-01",
      },
    });
    expect(status.limit).toBe(TRAILBLAZER_MONTHLY_LIMIT);
    expect(status.remaining).toBe(TRAILBLAZER_MONTHLY_LIMIT - 10);
  });

  it("resetMonthlyGenerationAllowance clears monthly count but keeps generation_count", () => {
    const prefs = resetMonthlyGenerationAllowance({
      monthly_generation_count: 17,
      monthly_generation_reset_date: "2020-01-01",
      generation_count: 9,
      vehicle: "Car",
    });
    expect(prefs.monthly_generation_count).toBe(0);
    expect(prefs.monthly_generation_reset_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prefs.generation_count).toBe(9);
    expect(prefs.vehicle).toBe("Car");
  });
});
