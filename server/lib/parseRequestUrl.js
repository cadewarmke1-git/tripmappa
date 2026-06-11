/** Parse request URL with the WHATWG URL API (replaces legacy url.parse). */

function requestUrlBase(req) {
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost";
}

export function getRequestPathname(req) {
  const raw = req?.url || "/";
  try {
    const parsed = raw.startsWith("/")
      ? new URL(raw, requestUrlBase(req))
      : new URL(raw);
    return parsed.pathname || "/";
  } catch {
    return raw.split("?")[0] || "/";
  }
}

export function getRequestSearchParams(req) {
  const raw = req?.url || "/";
  try {
    const parsed = raw.startsWith("/")
      ? new URL(raw, requestUrlBase(req))
      : new URL(raw);
    return parsed.searchParams;
  } catch {
    const q = raw.indexOf("?");
    if (q < 0) return new URLSearchParams();
    return new URLSearchParams(raw.slice(q + 1));
  }
}
