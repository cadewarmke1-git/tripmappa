/** Fuel price enrichment for Google-found gas stations (EIA regional averages). */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { captureServerException } from "../lib/sentry.js";
import {
  FALLBACK_EIA,
  fetchEIAFuelPrices,
  fetchRegionalPricesForPoints,
  formatGalPrice,
} from "../lib/eiaFuelPrices.js";

function inferBrand(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("shell")) return "Shell";
  if (n.includes("chevron")) return "Chevron";
  if (n.includes("exxon") || n.includes("mobil")) return "Exxon";
  if (n.includes("bp")) return "BP";
  if (n.includes("pilot") || n.includes("flying j")) return "Pilot Flying J";
  if (n.includes("love")) return "Love's";
  if (n.includes("ta ") || n.includes("travel center")) return "TA Travel Center";
  if (n.includes("petro")) return "Petro";
  if (n.includes("marathon")) return "Marathon";
  if (n.includes("speedway")) return "Speedway";
  return name?.split(" ")[0] || "Gas Station";
}

function estimatePrices(mode, eia) {
  const regular = eia?.regular ?? FALLBACK_EIA.regular;
  const premium = eia?.premium ?? FALLBACK_EIA.premium;
  const diesel = eia?.diesel ?? FALLBACK_EIA.diesel;

  if (mode === "diesel") {
    return { dieselPrice: formatGalPrice(diesel), fuelTypes: ["Diesel"], hasDef: true };
  }
  return {
    regularPrice: formatGalPrice(regular),
    premiumPrice: formatGalPrice(premium),
    fuelTypes: ["Regular", "Premium"],
    hasDef: false,
  };
}

function enrichStation(googleStation, mode, eia) {
  const name = googleStation.name || "Gas Station";
  const brand = inferBrand(name);
  const isTruckStop = /pilot|love|ta |petro|flying j/i.test(name);
  const priceData = estimatePrices(mode, eia);

  return {
    id: googleStation.id || googleStation.placeId,
    placeId: googleStation.placeId,
    name,
    brand,
    address: googleStation.address || "Along route",
    distanceMiles: googleStation.distanceMiles,
    lat: googleStation.lat,
    lng: googleStation.lng,
    ...priceData,
    hasDef: mode === "diesel" || isTruckStop,
    estimated: true,
    livePrices: false,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const body = req.body || {};

  // Regional corridor prices for pre-Claude segment scoring (not baked into place caches).
  if (body.mode === "regional-prices") {
    const points = Array.isArray(body.points) ? body.points.slice(0, 16) : [];
    if (!points.length) {
      return res.status(400).json({ error: "points array is required" });
    }
    try {
      const pricesById = await fetchRegionalPricesForPoints(points);
      return res.status(200).json({ pricesById, fallback: false });
    } catch (err) {
      console.warn("regional fuel prices error:", err.message);
      captureServerException(err);
      return res.status(200).json({ pricesById: {}, fallback: true });
    }
  }

  const { stations = [], mode = "gas" } = body;
  if (!Array.isArray(stations) || !stations.length || stations.length > 30) {
    return res.status(400).json({ error: "Missing stations array from Google Places" });
  }

  try {
    const eia = await fetchEIAFuelPrices();
    const enriched = stations.map(s => enrichStation(s, mode, eia));

    return res.status(200).json({
      stations: enriched,
      fallback: true,
      livePrices: false,
    });
  } catch (err) {
    console.error("fuel-stations enrich error:", err);
    captureServerException(err);
    const eia = await fetchEIAFuelPrices();
    return res.status(200).json({
      stations: stations.map(s => enrichStation(s, mode, eia)),
      fallback: true,
      livePrices: false,
      error: "Failed to enrich fuel stations",
    });
  }
}
