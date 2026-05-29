/** In-memory TTL cache — reused across warm Vercel serverless invocations. */
const store = new Map();
const MAX_ENTRIES = 500;

export function roundCoord(value, decimals = 2) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = 10 * 60 * 1000) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest != null) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export async function cacheThrough(key, ttlMs, loader) {
  const cached = cacheGet(key);
  if (cached != null) return { value: cached, cached: true };
  const value = await loader();
  if (value != null) cacheSet(key, value, ttlMs);
  return { value, cached: false };
}
