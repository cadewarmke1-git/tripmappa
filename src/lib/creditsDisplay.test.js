import { describe, expect, it } from "vitest";
import { formatCreditsDisplay } from "./creditsDisplay.js";
import { TIERS } from "./tiers.js";

describe("formatCreditsDisplay", () => {
  it("shows wanderer lifetime remaining", () => {
    expect(formatCreditsDisplay({ tier: TIERS.WANDERER, remaining: 2, billingPeriod: "lifetime" }).label)
      .toBe("2 trips left on your plan");
  });

  it("shows voyager monthly counter", () => {
    const { label, nudge } = formatCreditsDisplay({
      tier: TIERS.VOYAGER,
      remaining: 5,
      limit: 20,
      monthlyUsed: 15,
      billingPeriod: "monthly",
    });
    expect(label).toBe("5 of 20 remaining this month");
    expect(nudge).toMatch(/Running low/);
  });

  it("shows guest sign-in nudge", () => {
    expect(formatCreditsDisplay({ tier: "guest" }).label)
      .toBe("1 free trip — sign in to save your plan");
  });

  it("shows trailblazer monthly counter without marketing copy", () => {
    expect(formatCreditsDisplay({
      tier: TIERS.TRAILBLAZER,
      remaining: 80,
      limit: 100,
      billingPeriod: "monthly",
    }).label).toBe("80 of 100 remaining this month");
  });
});
