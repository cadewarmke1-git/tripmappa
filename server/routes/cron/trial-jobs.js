import { runAllTrialJobs } from "../../lib/trialJobs.js";

/** GET /api/cron/trial-jobs — day-6 reminder emails and day-7 trial expiry (Vercel cron). */
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
    const result = await runAllTrialJobs();
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("cron/trial-jobs error:", err);
    return res.status(500).json({ error: "Trial jobs failed" });
  }
}
