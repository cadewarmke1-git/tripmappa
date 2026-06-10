import { fetchCollaboration } from "./collaborationApi.js";

const POLL_INTERVAL_MS = 8000;

/** Poll collaboration updates by invite token (no broad anon table subscriptions). */
export function subscribeCollaboration(inviteToken, onUpdate) {
  if (!inviteToken) return () => {};

  let cancelled = false;

  async function poll() {
    if (cancelled) return;
    try {
      const data = await fetchCollaboration(inviteToken);
      if (data?.collaboration && !cancelled) {
        onUpdate(data.collaboration);
      }
    } catch {
      // ignore transient poll errors
    }
  }

  poll();
  const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}
