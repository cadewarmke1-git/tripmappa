import { isExemptFounderUser } from "./foundingMembers.js";

/** Designated admin email — bypasses all generation limits when signed in. */
export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}

export function isAdminEmail(email) {
  const admin = getAdminEmail();
  if (!admin || !email) return false;
  return String(email).trim().toLowerCase() === admin;
}

/** Permanent unlimited credits: ADMIN_USER_IDS or ADMIN_EMAIL match. */
export function isUnlimitedUser({ userId, email } = {}) {
  return isExemptFounderUser(userId) || isAdminEmail(email);
}
