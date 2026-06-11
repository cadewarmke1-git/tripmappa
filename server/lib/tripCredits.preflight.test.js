import { describe, expect, it } from "vitest";
import {
  preflightCreditFromClient,
  FREE_LIFETIME_LIMIT,
} from "../../server/lib/tripCredits.js";

describe("preflightCreditFromClient", () => {
  it("returns null when client cache is missing", () => {
    expect(preflightCreditFromClient(null, "user-1")).toBeNull();
    expect(preflightCreditFromClient(undefined, "user-1")).toBeNull();
  });

  it("blocks zero remaining without DB", () => {
    const result = preflightCreditFromClient({
      tier: "voyager",
      remaining: 0,
      unlimited: false,
      resetDate: "2099-01-01",
    }, "user-1");
    expect(result.ok).toBe(false);
    expect(result.limitReached).toBe(true);
  });

  it("allows positive remaining without DB", () => {
    const result = preflightCreditFromClient({
      tier: "wanderer",
      remaining: FREE_LIFETIME_LIMIT - 1,
      unlimited: false,
    }, "user-1");
    expect(result.ok).toBe(true);
  });

  it("rejects tampered unlimited for non-admin users", () => {
    const result = preflightCreditFromClient({
      tier: "wanderer",
      remaining: 99,
      unlimited: true,
    }, "regular-user-id");
    expect(result).toBeNull();
  });

  it("accepts unlimited preflight for ADMIN_EMAIL", () => {
    const prev = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = "admin@example.com";
    try {
      const result = preflightCreditFromClient({
        tier: "wanderer",
        remaining: 0,
        unlimited: true,
      }, "user-1", "admin@example.com");
      expect(result?.ok).toBe(true);
      expect(result?.status?.unlimited).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = prev;
    }
  });
});
