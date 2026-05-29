/** Fire-and-forget client error reporting. */
export function reportClientError({ label, message, stack, url }) {
  if (!message && !label) return;
  try {
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label || "client",
        message: message || "Unknown error",
        stack: stack ? String(stack).slice(0, 800) : undefined,
        url: url || (typeof window !== "undefined" ? window.location.href : null),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
