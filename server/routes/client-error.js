/** POST /api/client-error — client-side error reports for production debugging. */
import { logClientError } from "../lib/apiLog.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { label, message, url, stack } = req.body || {};
  if (!message && !label) {
    return res.status(400).json({ error: "message or label required" });
  }

  logClientError({ label, message, url, stack: stack ? String(stack).slice(0, 500) : null });
  return res.status(204).end();
}
