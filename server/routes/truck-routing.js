/** POST /api/truck-routing — HERE truck routes with weigh stations along corridor. */
import { geocodeAddress } from "../lib/geocode.js";
import { getHereApiKey } from "../lib/hereApiKey.js";
import { decodeFlexiblePolyline } from "../lib/hereFlexiblePolyline.js";
import { resolveTruckRequestSpecs } from "../lib/truckSpecs.js";

const ROUTES_URL = "https://router.hereapi.com/v8/routes";
const DISCOVER_URL = "https://discover.search.hereapi.com/v1/discover";

function formatDistanceMeters(meters) {
  const miles = meters / 1609.344;
  if (miles >= 100) return `${Math.round(miles).toLocaleString()} mi`;
  if (miles >= 10) return `${miles.toFixed(1)} mi`;
  return `${miles.toFixed(1)} mi`;
}

function formatDurationSeconds(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h <= 0) return `${m} min`;
  if (m <= 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function sampleRoutePoints(points, max = 8) {
  if (!points?.length) return [];
  if (points.length <= max) return points;
  const out = [];
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i / Math.max(1, max - 1)) * (points.length - 1));
    out.push(points[idx]);
  }
  return out;
}

function extractRestrictions(routeData) {
  const restrictions = [];
  const routes = routeData?.routes || [];
  for (const route of routes) {
    for (const section of route.sections || []) {
      for (const notice of section.notices || []) {
        restrictions.push({
          type: notice.code || notice.title || "restriction",
          message: notice.text || notice.title || notice.details?.[0]?.cause || "Truck restriction",
          roadName: notice.details?.[0]?.restrictedArea?.name
            || notice.details?.[0]?.cause
            || section.departure?.place?.name
            || null,
          severity: notice.severity || "info",
        });
      }
      for (const span of section.spans || []) {
        for (const notice of span.notices || []) {
          restrictions.push({
            type: notice.code || "span_restriction",
            message: notice.text || notice.title || "Route span restriction",
            roadName: span.names?.[0] || notice.details?.[0]?.cause || null,
            severity: notice.severity || "warning",
          });
        }
      }
    }
  }
  const seen = new Set();
  return restrictions.filter(r => {
    const key = `${r.type}|${r.message}|${r.roadName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergePolylines(sections) {
  const merged = [];
  for (const section of sections || []) {
    if (!section.polyline) continue;
    const pts = decodeFlexiblePolyline(section.polyline);
    for (const pt of pts) {
      const last = merged[merged.length - 1];
      if (last && last.lat === pt.lat && last.lng === pt.lng) continue;
      merged.push({ lat: pt.lat, lng: pt.lng });
    }
  }
  return merged;
}

function parseOpeningHours(item) {
  const hours = item?.openingHours || item?.extended?.openingHours;
  if (!hours?.length) return null;
  const texts = hours
    .map(h => h.text || h.structured?.[0]?.start || null)
    .filter(Boolean);
  return texts.length ? texts.join("; ") : null;
}

async function searchWeighStations(apiKey, routePoints) {
  const samples = sampleRoutePoints(routePoints, 6);
  const found = new Map();

  await Promise.all(samples.map(async (pt) => {
    try {
      const params = new URLSearchParams({
        apiKey,
        q: "weigh station",
        at: `${pt.lat},${pt.lng}`,
        limit: "5",
        lang: "en-US",
      });
      const res = await fetch(`${DISCOVER_URL}?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      for (const item of data.items || []) {
        const pos = item.position || item.access?.[0]?.lat != null
          ? { lat: item.access?.[0]?.lat ?? item.position?.lat, lng: item.access?.[0]?.lng ?? item.position?.lng }
          : null;
        if (!pos?.lat || !pos?.lng) continue;
        const id = item.id || `${pos.lat.toFixed(4)},${pos.lng.toFixed(4)}`;
        if (found.has(id)) continue;
        found.set(id, {
          id,
          name: item.title || item.name || "Weigh station",
          location: item.address?.label || item.address?.street || item.vicinity || "",
          lat: pos.lat,
          lng: pos.lng,
          hours: parseOpeningHours(item),
          category: "weigh_station",
        });
      }
    } catch {
      // silent — weigh stations are supplemental
    }
  }));

  return [...found.values()].slice(0, 12);
}

async function resolveLatLng(origin, destination) {
  const o = typeof origin === "object" && origin?.lat != null
    ? { lat: origin.lat, lng: origin.lng }
    : await geocodeAddress(String(origin));
  const d = typeof destination === "object" && destination?.lat != null
    ? { lat: destination.lat, lng: destination.lng }
    : await geocodeAddress(String(destination));
  return { origin: o, destination: d };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = getHereApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: "HERE API key not configured" });
  }

  const { origin, destination } = req.body || {};
  if (!origin || !destination) {
    return res.status(400).json({ error: "origin and destination are required" });
  }

  const specs = resolveTruckRequestSpecs(req.body);

  try {
    const coords = await resolveLatLng(origin, destination);
    if (!coords.origin || !coords.destination) {
      return res.status(404).json({ error: "Could not geocode origin or destination" });
    }

    const params = new URLSearchParams({
      apiKey,
      transportMode: "truck",
      routingMode: "fast",
      origin: `${coords.origin.lat},${coords.origin.lng}`,
      destination: `${coords.destination.lat},${coords.destination.lng}`,
      return: "polyline,summary,actions,instructions,travelSummary",
      "vehicle[height]": String(specs.heightCm),
      "vehicle[grossWeight]": String(specs.weightKg),
      "vehicle[axleCount]": String(specs.axleCount),
    });
    if (specs.hazmat) {
      params.set("vehicle[shippedHazardousGoods]", "flammable,gas,combustible,corrosive,toxic");
    }

    const routeRes = await fetch(`${ROUTES_URL}?${params}`);
    const routeData = await routeRes.json();

    if (!routeRes.ok) {
      const msg = routeData?.title || routeData?.cause || routeData?.error || "HERE routing failed";
      return res.status(routeRes.status >= 400 && routeRes.status < 600 ? routeRes.status : 502).json({ error: msg });
    }

    const route = routeData?.routes?.[0];
    if (!route?.sections?.length) {
      return res.status(404).json({ error: "No truck route found for this corridor" });
    }

    const routePoints = mergePolylines(route.sections);
    const totalMeters = route.sections.reduce((sum, s) => sum + (s.summary?.length || 0), 0);
    const totalSeconds = route.sections.reduce((sum, s) => sum + (s.summary?.duration || 0), 0);
    const restrictions = extractRestrictions(routeData);
    const warnings = restrictions.filter(r => r.severity === "warning" || r.severity === "critical");

    const polylines = route.sections
      .map(s => s.polyline)
      .filter(Boolean);

    let weighStations = [];
    if (routePoints.length > 1) {
      weighStations = await searchWeighStations(apiKey, routePoints);
    }

    return res.status(200).json({
      provider: "here",
      transportMode: "truck",
      polyline: polylines[0] || null,
      polylines,
      routePoints,
      distance: formatDistanceMeters(totalMeters),
      distanceMeters: totalMeters,
      duration: formatDurationSeconds(totalSeconds),
      durationSeconds: totalSeconds,
      restrictions,
      warnings,
      weighStations,
      vehicle: {
        heightFeet: specs.heightFeet,
        heightMeters: specs.heightMeters,
        weightLbs: specs.weightLbs,
        weightKg: specs.weightKg,
        axleCount: specs.axleCount,
        hazmat: specs.hazmat,
      },
      hereRoute: routeData,
    });
  } catch (err) {
    console.error("truck-routing error:", err);
    return res.status(500).json({ error: "Truck routing failed" });
  }
}
