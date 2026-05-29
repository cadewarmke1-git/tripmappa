/** Structured API logging for Vercel function logs. */
export function logApiRequest(route, { method, status, ms, error, cached } = {}) {
  const payload = {
    route: `/api/${route}`,
    method: method || "GET",
    status: status ?? null,
    ms: ms != null ? Math.round(ms) : null,
    cached: cached === true ? true : undefined,
    error: error ? String(error).slice(0, 240) : undefined,
    ts: new Date().toISOString(),
  };
  if (status && status >= 500) {
    console.error("[api]", JSON.stringify(payload));
  } else {
    console.info("[api]", JSON.stringify(payload));
  }
}

export function logClientError(body = {}) {
  console.error("[client-error]", JSON.stringify({
    label: body.label || "unknown",
    message: String(body.message || "").slice(0, 300),
    url: body.url || null,
    ts: new Date().toISOString(),
  }));
}
