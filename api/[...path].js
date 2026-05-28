/**
 * Single Vercel serverless entry for all /api/* routes.
 * Handlers live in server/routes/ (not under api/) to stay within Hobby plan limits.
 */
const ROUTES = {
  "claude": () => import("../server/routes/claude.js"),
  "distance-matrix": () => import("../server/routes/distance-matrix.js"),
  "ev-charging": () => import("../server/routes/ev-charging.js"),
  "fuel-stations": () => import("../server/routes/fuel-stations.js"),
  "geocode": () => import("../server/routes/geocode.js"),
  "join-convoy": () => import("../server/routes/join-convoy.js"),
  "plan-trip": () => import("../server/routes/plan-trip.js"),
  "register-follower-phone": () => import("../server/routes/register-follower-phone.js"),
  "restaurants": () => import("../server/routes/restaurants.js"),
  "route-optimize": () => import("../server/routes/route-optimize.js"),
  "send-sms-otp": () => import("../server/routes/send-sms-otp.js"),
  "share-trip": () => import("../server/routes/share-trip.js"),
  "sos-alert": () => import("../server/routes/sos-alert.js"),
  "trip-credits": () => import("../server/routes/trip-credits.js"),
  "update-convoy-location": () => import("../server/routes/update-convoy-location.js"),
  "update-location": () => import("../server/routes/update-location.js"),
  "verify-sms-otp": () => import("../server/routes/verify-sms-otp.js"),
  "weather": () => import("../server/routes/weather.js"),
};

export default async function handler(req, res) {
  const parts = req.query?.path;
  const route = Array.isArray(parts) ? parts.join("/") : (parts || "");
  const load = ROUTES[route];

  if (!load) {
    return res.status(404).json({ error: `Unknown API route: /api/${route}` });
  }

  try {
    const mod = await load();
    if (typeof mod.default !== "function") {
      return res.status(500).json({ error: `Route handler missing: /api/${route}` });
    }
    return mod.default(req, res);
  } catch (err) {
    console.error(`API router error (/api/${route}):`, err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
