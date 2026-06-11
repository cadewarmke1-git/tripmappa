import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isAdminEmail, isUnlimitedUser } from "./adminAccess.js";

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
});
