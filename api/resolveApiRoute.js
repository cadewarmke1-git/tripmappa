/** Resolve /api/* subpath for the consolidated router (Vite is not Next.js — no [...path] catch-all). */
export function resolveApiRoute(req) {
  const parts = req.query?.path;
  if (parts) {
    const fromQuery = Array.isArray(parts) ? parts.join("/") : String(parts);
    if (fromQuery) return fromQuery.replace(/^\/+|\/+$/g, "");
  }

  const raw = req.url || "";
  const pathname = raw.split("?")[0];
  const prefix = "/api/";
  if (pathname.startsWith(prefix)) {
    const fromUrl = pathname.slice(prefix.length).replace(/\/$/, "");
    if (fromUrl && fromUrl !== "router") return decodeURIComponent(fromUrl);
  }

  return "";
}
