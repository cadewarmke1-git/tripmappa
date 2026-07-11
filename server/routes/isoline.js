/** POST /api/isoline — HERE drive-time reach polygon from an origin. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { captureServerException } from "../lib/sentry.js";
import { getHereAccessToken } from "../lib/hereAuth.js";
import { hasHereCredentials } from "../lib/hereApiKey.js";
import { decodeFlexiblePolyline } from "../lib/hereFlexiblePolyline.js";

const ISOLINE_URL = "https://isoline.router.hereapi.com/v8/isolines";

function parsePolygonOuter(entry) {
  if (!entry) return [];
  if (typeof entry === "string") return decodeFlexiblePolyline(entry);
  if (typeof entry.outer === "string") return decodeFlexiblePolyline(entry.outer);
  if (Array.isArray(entry.outer)) {
    return entry.outer.map(p => {
      if (Array.isArray(p)) return { lat: p[0], lng: p[1] };
      return { lat: p.lat, lng: p.lng };
    });
  }
  if (Array.isArray(entry)) {
    return entry.map(p => {
      if (Array.isArray(p)) return { lat: p[0], lng: p[1] };
      return { lat: p.lat, lng: p.lng };
    });
  }
  return [];
}

function pickLargestPolygon(isoline) {
  const rings = [];
  for (const poly of isoline?.polygons || []) {
    const ring = parsePolygonOuter(poly);
    if (ring.length > 2) rings.push(ring);
  }
  if (!rings.length) return [];
  rings.sort((a, b) => b.length - a.length);
  return rings[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardProxyRoute(req, res)) return undefined;

  if (!hasHereCredentials()) {
    return res.status(503).json({ error: "HERE API credentials not configured" });
  }

  const {
    originLat,
    originLng,
    originLatitude,
    originLongitude,
    driveTimeSeconds,
    driveTime,
  } = req.body || {};

  const lat = Number(originLat ?? originLatitude);
  const lng = Number(originLng ?? originLongitude);
  const seconds = Math.round(Number(driveTimeSeconds ?? driveTime));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "originLat and originLng are required" });
  }
  if (!Number.isFinite(seconds) || seconds < 60 || seconds > 86400) {
    return res.status(400).json({ error: "driveTimeSeconds must be between 60 and 86400" });
  }

  try {
    const accessToken = await getHereAccessToken();

    const params = new URLSearchParams({
      transportMode: "car",
      origin: `${lat},${lng}`,
      "range[type]": "time",
      "range[values]": String(seconds),
    });

    const isolineRes = await fetch(`${ISOLINE_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await isolineRes.json();

    if (!isolineRes.ok) {
      const msg = data?.title || data?.cause || data?.error || "HERE isoline request failed";
      return res.status(isolineRes.status >= 400 && isolineRes.status < 600 ? isolineRes.status : 502).json({ error: msg });
    }

    const isoline = data?.isolines?.[0];
    const polygon = pickLargestPolygon(isoline);

    if (polygon.length < 3) {
      return res.status(404).json({ error: "No isoline polygon returned for this origin and drive time" });
    }

    return res.status(200).json({
      polygon,
      center: { lat, lng },
      driveTimeSeconds: seconds,
      range: isoline?.range || { type: "time", value: seconds },
    });
  } catch (err) {
    console.error("isoline error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Isoline request failed" });
  }
}
