import { describe, expect, it } from "vitest";
import { getEffectiveTier, hasActiveVoyagerBonus } from "../../server/lib/tierEffective.js";

describe("tierEffective", () => {
  it("applies Voyager bonus over Wanderer", () => {
    const profile = {
      tier: "wanderer",
      voyager_bonus_until: new Date(Date.now() + 86400000).toISOString(),
    };
    expect(hasActiveVoyagerBonus(profile)).toBe(true);
    expect(getEffectiveTier(profile)).toBe("voyager");
  });

  it("applies active Trailblazer trial", () => {
    const profile = {
      tier: "trailblazer",
      trailblazer_trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
      stripe_subscription_id: null,
    };
    expect(getEffectiveTier(profile)).toBe("trailblazer");
  });
});
