import { describe, expect, it, afterEach, vi } from "vitest";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

describe("foundingMembers exempt list", () => {
  const original = process.env.ADMIN_USER_IDS;
  const originalAdminEmail = process.env.ADMIN_EMAIL;

  afterEach(() => {
    vi.restoreAllMocks();
    if (original === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = original;
    if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalAdminEmail;
  });

  it("parses valid ADMIN_USER_IDS and drops invalid entries with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.ADMIN_USER_IDS = `${UUID_A}, not-a-uuid, ${UUID_B} ,bad,${UUID_C}`;
    const mod = await import("./foundingMembers.js?t=" + Date.now());
    expect(mod.EXEMPT_USER_IDS).toEqual([UUID_A, UUID_B, UUID_C]);
    expect(mod.isExemptFounderUser(UUID_B)).toBe(true);
    expect(mod.isExemptFounderUser("other")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("caps the public Founder program at 250 and excludes founder-owned emails", async () => {
    process.env.ADMIN_EMAIL = "cadewarmke@gmail.com";
    const mod = await import("./foundingMembers.js?t=" + Date.now() + "-250");
    expect(mod.FOUNDING_MEMBER_MAX).toBe(250);
    expect(mod.FOUNDING_BENEFIT_MONTHS).toBe(3);
    expect(mod.isFounderOwnedSlotEmail("cadewarmke@gmail.com")).toBe(true);
    expect(mod.isFounderOwnedSlotEmail("tripmappa@gmail.com")).toBe(true);
    expect(mod.isFounderOwnedSlotEmail("smoke.p1.x@tripmappa.test")).toBe(true);
    expect(mod.isFounderOwnedSlotEmail("traveler@example.com")).toBe(false);
  });
});
