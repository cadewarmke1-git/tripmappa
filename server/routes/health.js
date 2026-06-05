/** GET /api/health — deploy smoke and uptime checks. */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const hasGoogleKey = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (req.method === "HEAD") {
    return res.status(200).end();
  }
  return res.status(200).json({
    ok: true,
    service: "tripmappa",
    ts: new Date().toISOString(),
    config: {
      googleMaps: hasGoogleKey,
      supabase: hasSupabase,
    },
  });
}
