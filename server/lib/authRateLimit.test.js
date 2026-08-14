import { describe, expect, it } from "vitest";
import {
  checkAuthRateLimit,
  isAuthHoneypotTripped,
  isValidAuthEmail,
  recordAuthRateLimitHit,
} from "./authRateLimit.js";

describe("authRateLimit", () => {
  it("validates email shape", () => {
    expect(isValidAuthEmail("a@b.co")).toBe(true);
    expect(isValidAuthEmail("not-an-email")).toBe(false);
    expect(isAuthHoneypotTripped("http://spam")).toBe(true);
    expect(isAuthHoneypotTripped("")).toBe(false);
  });

  it("rate limits repeated sign-in attempts for the same email", () => {
    const email = `burst-${Date.now()}@tripmappa.test`;
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
    let now = Date.now();

    for (let i = 0; i < 5; i += 1) {
      const check = checkAuthRateLimit({ action: "signin", email, ip, now });
      expect(check.ok).toBe(true);
      recordAuthRateLimitHit({ action: "signin", email, ip, now });
      now += 1000;
    }

    const blocked = checkAuthRateLimit({ action: "signin", email, ip, now });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/burst|hour/);
  });
});
