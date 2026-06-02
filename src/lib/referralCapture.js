const REFERRAL_STORAGE_KEY = "tripmappa-referral-code";

/** Persist ?ref= from URL for signup attribution. */
export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref?.trim()) {
      sessionStorage.setItem(REFERRAL_STORAGE_KEY, ref.trim().toLowerCase());
    }
  } catch {
    /* ignore */
  }
}

export function getStoredReferralCode() {
  try {
    return sessionStorage.getItem(REFERRAL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearStoredReferralCode() {
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
