import { describe, expect, it } from "vitest";
import { buildUserProfileUpsertRow } from "./userProfileDefaults.js";

describe("buildUserProfileUpsertRow", () => {
  it("includes wanderer tier and credit defaults for new profile inserts", () => {
    const row = buildUserProfileUpsertRow("67b72102-493e-40be-b131-f72fed078af6");
    expect(row.tier).toBe("wanderer");
    expect(row.generations_used).toBe(0);
    expect(row.credits_month).toMatch(/^\d{4}-\d{2}$/);
    expect(row.plan_preferences.monthly_generation_count).toBe(0);
    expect(row.plan_preferences.monthly_generation_reset_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("allows overrides without dropping required defaults on other fields", () => {
    const row = buildUserProfileUpsertRow("67b72102-493e-40be-b131-f72fed078af6", {
      referral_code: "tm-abc123",
    });
    expect(row.referral_code).toBe("tm-abc123");
    expect(row.tier).toBe("wanderer");
  });
});
