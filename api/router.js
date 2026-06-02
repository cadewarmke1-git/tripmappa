/**
 * Single Vercel serverless entry for all /api/* routes.
 * Handlers live in server/routes/ — never add new files under api/ (Hobby plan limit: 12 functions).
 *
 * Vite projects do not support Next.js-style api/[...path] catch-alls on Vercel; vercel.json
 * rewrites /api/* here with ?path=… (see resolveApiRoute).
 */
import { logApiRequest } from "../server/lib/apiLog.js";
import { readRawBody } from "../server/lib/readRawBody.js";
import { resolveApiRoute } from "./resolveApiRoute.js";

const ROUTES = {
  "account-onboarding": () => import("../server/routes/account-onboarding.js"),
  "client-error": () => import("../server/routes/client-error.js"),
  "cron/trial-jobs": () => import("../server/routes/cron/trial-jobs.js"),
  "claude": () => import("../server/routes/claude.js"),
  "distance-matrix": () => import("../server/routes/distance-matrix.js"),
  "ev-charging": () => import("../server/routes/ev-charging.js"),
  "founding-claim": () => import("../server/routes/founding-claim.js"),
  "founding-slots": () => import("../server/routes/founding-slots.js"),
  "fuel-stations": () => import("../server/routes/fuel-stations.js"),
  "geocode": () => import("../server/routes/geocode.js"),
  "grocery/order": () => import("../server/routes/grocery-order.js"),
  "health": () => import("../server/routes/health.js"),
  "isoline": () => import("../server/routes/isoline.js"),
  "join-convoy": () => import("../server/routes/join-convoy.js"),
  "plan-trip": () => import("../server/routes/plan-trip.js"),
  "register-follower-phone": () => import("../server/routes/register-follower-phone.js"),
  "restaurants": () => import("../server/routes/restaurants.js"),
  "route-optimize": () => import("../server/routes/route-optimize.js"),
  "send-sms-otp": () => import("../server/routes/send-sms-otp.js"),
  "share-trip": () => import("../server/routes/share-trip.js"),
  "sos-alert": () => import("../server/routes/sos-alert.js"),
  "stripe/create-checkout-session": () => import("../server/routes/stripe/create-checkout-session.js"),
  "stripe/create-portal-session": () => import("../server/routes/stripe/create-portal-session.js"),
  "stripe/webhook": () => import("../server/routes/stripe/webhook.js"),
  "trial/dismiss-prompt": () => import("../server/routes/trial/dismiss-prompt.js"),
  "trip-credits": () => import("../server/routes/trip-credits.js"),
  "trip-tips": () => import("../server/routes/trip-tips.js"),
  "truck-routing": () => import("../server/routes/truck-routing.js"),
  "user-trip-preferences": () => import("../server/routes/user-trip-preferences.js"),
  "update-convoy-location": () => import("../server/routes/update-convoy-location.js"),
  "update-location": () => import("../server/routes/update-location.js"),
  "verify-sms-otp": () => import("../server/routes/verify-sms-otp.js"),
  "weather": () => import("../server/routes/weather.js"),
};

async function ensureRequestBody(req, route) {
  if (req.method === "GET" || req.method === "HEAD") return;

  if (req.rawBody !== undefined) {
    if (route === "stripe/webhook") return;
    if (req.body === undefined) {
      if (!req.rawBody.length) {
        req.body = {};
        return;
      }
      try {
        req.body = JSON.parse(req.rawBody.toString("utf8"));
      } catch {
        req.body = {};
      }
    }
    return;
  }

  if (req.body !== undefined) return;

  const raw = await readRawBody(req);
  req.rawBody = raw;

  if (route === "stripe/webhook") return;

  if (!raw.length) {
    req.body = {};
    return;
  }
  try {
    req.body = JSON.parse(raw.toString("utf8"));
  } catch {
    req.body = {};
  }
}

export default async function handler(req, res) {
  const route = resolveApiRoute(req);
  const load = ROUTES[route];
  const started = Date.now();

  try {
    await ensureRequestBody(req, route);
  } catch (err) {
    logApiRequest(route || "unknown", { method: req.method, status: 400, ms: Date.now() - started });
    if (!res.headersSent) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    return undefined;
  }

  if (!load) {
    logApiRequest(route || "unknown", { method: req.method, status: 404, ms: Date.now() - started });
    return res.status(404).json({ error: `Unknown API route: /api/${route || "(missing path)"}` });
  }

  try {
    const mod = await load();
    if (typeof mod.default !== "function") {
      logApiRequest(route, { method: req.method, status: 500, ms: Date.now() - started });
      return res.status(500).json({ error: `Route handler missing: /api/${route}` });
    }
    const result = await mod.default(req, res);
    if (!res.headersSent) {
      logApiRequest(route, { method: req.method, status: 200, ms: Date.now() - started });
    }
    return result;
  } catch (err) {
    logApiRequest(route, {
      method: req.method,
      status: 500,
      ms: Date.now() - started,
      error: err.message,
    });
    console.error(`API router error (/api/${route}):`, err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
    return undefined;
  }
}
