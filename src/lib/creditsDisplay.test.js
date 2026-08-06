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
      remaining: 2,
      limit: 6,
      monthlyUsed: 4,
      billingPeriod: "monthly",
    });
    expect(label).toBe("2 of 6 remaining this month");
    expect(nudge).toMatch(/Running low/);
  });

  it("hides misleading guest generation label", () => {
    expect(formatCreditsDisplay({ tier: "guest" }).label).toBeNull();
    expect(formatCreditsDisplay({ tier: "guest" }).nudge).toBeNull();
  });

  it("shows unlimited label for admin accounts", () => {
    expect(formatCreditsDisplay({ isAdmin: true, unlimited: true, tier: TIERS.TRAILBLAZER }).label)
      .toBe("Unlimited trip generations");
  });

  it("shows trailblazer monthly counter without marketing copy", () => {
    expect(formatCreditsDisplay({
      tier: TIERS.TRAILBLAZER,
      remaining: 8,
      limit: 12,
      billingPeriod: "monthly",
    }).label).toBe("8 of 12 remaining this month");
  });
});
