/** Short vibration for primary actions (mobile browsers with Vibration API). */
export function triggerPrimaryHaptic() {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(12);
  } catch {
    /* unsupported or blocked */
  }
}
