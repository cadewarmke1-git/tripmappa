import { isExemptFounderUser } from "./foundingMembers.js";

/** Playwright / E2E admin — email/password auth for automated testing. */
export const PLAYWRIGHT_ADMIN_EMAIL = "tripmappa@gmail.com";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** All designated admin emails — bypass generation limits when signed in. */
export function getAdminEmails() {
  const emails = new Set();
  const primary = normalizeEmail(process.env.ADMIN_EMAIL);
  if (primary) emails.add(primary);
  emails.add(normalizeEmail(PLAYWRIGHT_ADMIN_EMAIL));
  return [...emails];
}

/** @deprecated Prefer getAdminEmails(); kept for single-email callers. */
export function getAdminEmail() {
  return getAdminEmails()[0] || "";
}

export function isAdminEmail(email) {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  return getAdminEmails().includes(normalized);
}

/** Permanent unlimited credits: founder exemption or any designated admin email. */
export function isUnlimitedUser({ userId, email } = {}) {
  return isExemptFounderUser(userId) || isAdminEmail(email);
}

/** Admin bypass uses only the authenticated Supabase session email — never client headers or body. */
export function resolveSessionEmail(user) {
  return user?.email || null;
}

export function isUnlimitedSessionUser(user) {
  if (!user?.id) return false;
  return isUnlimitedUser({ userId: user.id, email: resolveSessionEmail(user) });
}
