const GUEST_KEY = "tripmappa-guest-generations";

export const GUEST_SESSION_LIMIT = 1;

export function getGuestCreditStatus() {
  const used = Number(sessionStorage.getItem(GUEST_KEY) || 0);
  const remaining = Math.max(0, GUEST_SESSION_LIMIT - used);
  return {
    tier: "guest",
    unlimited: false,
    remaining,
    limit: GUEST_SESSION_LIMIT,
    used,
  };
}

export function consumeGuestCredit() {
  const used = Number(sessionStorage.getItem(GUEST_KEY) || 0);
  if (used >= GUEST_SESSION_LIMIT) return false;
  sessionStorage.setItem(GUEST_KEY, String(used + 1));
  return true;
}

export function guestCreditsExhausted() {
  return getGuestCreditStatus().remaining <= 0;
}
