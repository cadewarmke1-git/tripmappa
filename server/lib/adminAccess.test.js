import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isAdminEmail,
  isUnlimitedUser,
  isUnlimitedSessionUser,
  resolveSessionEmail,
} from "./adminAccess.js";
import { preflightCreditFromClient, getCreditStatus } from "./tripCredits.js";

describe("adminAccess", () => {
  const prev = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    process.env.ADMIN_EMAIL = "admin@example.com";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = prev;
  });

  it("matches admin email case-insensitively", () => {
    expect(isAdminEmail("Admin@Example.com")).toBe(true);
    expect(isAdminEmail("other@example.com")).toBe(false);
  });

  it("grants unlimited when email matches ADMIN_EMAIL", () => {
    expect(isUnlimitedUser({ userId: "regular-user", email: "admin@example.com" })).toBe(true);
    expect(isUnlimitedUser({ userId: "regular-user", email: "other@example.com" })).toBe(false);
  });

  it("resolveSessionEmail uses only authenticated session email", () => {
    expect(resolveSessionEmail({ id: "u1", email: "user@example.com" })).toBe("user@example.com");
    expect(resolveSessionEmail({ id: "u1", email: null })).toBeNull();
  });

  it("forged admin email on non-admin session does not receive unlimited credits", () => {
    const sessionUser = { id: "regular-user", email: "regular@example.com" };
    expect(isUnlimitedSessionUser(sessionUser)).toBe(false);

    const preflight = preflightCreditFromClient({
      tier: "wanderer",
      remaining: 99,
      unlimited: true,
      adminEmail: "admin@example.com",
    }, sessionUser.id, resolveSessionEmail(sessionUser));
    expect(preflight).toBeNull();

    const status = getCreditStatus(
      { user_id: sessionUser.id, tier: "wanderer", generations_used: 0, plan_preferences: {} },
      sessionUser.id,
      resolveSessionEmail(sessionUser),
    );
    expect(status.unlimited).toBe(false);
    expect(status.isAdmin).toBe(false);
  });
});
