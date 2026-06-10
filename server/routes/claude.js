import { getUserFromRequest } from "../lib/authFromRequest.js";
import {
  CLAUDE_PROXY_MODELS,
  guardProxyRoute,
  resolveAllowedModel,
} from "../lib/apiSecurity.js";

/** Haiku proxy — authenticated TripMappa clients only. */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res, "claude")) return;

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required", code: "unauthenticated" });
  }

  const { prompt, model = "claude-haiku-4-5-20251001" } = req.body || {};
  const resolvedModel = resolveAllowedModel(model, "claude-haiku-4-5-20251001", CLAUDE_PROXY_MODELS);
  if (!process.env.ANTHROPIC_KEY) {
    return res.status(503).json({ error: "AI service not configured" });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt.slice(0, 12000) }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: "Upstream request failed" });
    }
    res.status(200).json(data);
  } catch {
    res.status(500).json({ error: "Request failed" });
  }
}
