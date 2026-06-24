import { runCacheCleanupJob } from "../../lib/cacheCleanup.js";

/** GET /api/cron/cache-cleanup — weekly purge of expired Supabase cache rows. */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: "Cron not configured" });
  }
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await runCacheCleanupJob();
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("cron/cache-cleanup error:", err);
    return res.status(500).json({ error: "Cache cleanup failed" });
  }
}
