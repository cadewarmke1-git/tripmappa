#!/usr/bin/env node
/** Post-deploy smoke check — hits /api/health (and optionally /api/trip-tips). */
const base = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

async function checkHealth() {
  const res = await fetch(`${base}/api/health`, { method: "GET" });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (!body?.ok) {
    throw new Error(`Health payload not ok: ${JSON.stringify(body)}`);
  }
  return body;
}

async function checkTripTips() {
  if (process.env.SMOKE_SKIP_TIPS === "1") return null;
  const res = await fetch(`${base}/api/trip-tips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: "Dallas, TX",
      destination: "Austin, TX",
      routePoints: [],
      waypoints: [],
    }),
  });
  if (!res.ok) {
    throw new Error(`Trip tips check failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

try {
  const health = await checkHealth();
  console.log(`[smoke] OK ${base}/api/health`, health.ts);
  const tips = await checkTripTips();
  if (tips) {
    console.log(`[smoke] OK ${base}/api/trip-tips`, `${tips.tips?.length ?? 0} tips`);
  }
  process.exit(0);
} catch (err) {
  console.error("[smoke] FAILED:", err.message || err);
  process.exit(1);
}
