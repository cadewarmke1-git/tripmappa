/** Fuel price enrichment for Google-found gas stations (EIA regional averages). */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { captureServerException } from "../lib/sentry.js";

const EIA_DATA_URL = "https://api.eia.gov/v2/petroleum/pri/gnd/data";
const EIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EIA_PRODUCTS = ["EPMR", "EPMP", "EPD2D"];

const FALLBACK_EIA = {
  regular: 3.45,
  premium: 4.05,
  diesel: 3.95,
};

let eiaPriceCache = null;

function buildEIAQuery() {
  const params = new URLSearchParams();
  params.set("frequency", "weekly");
  params.append("data[0]", "value");
  params.append("facets[duoarea][]", "NUS");
  EIA_PRODUCTS.forEach(product => params.append("facets[product][]", product));
  params.set("sort[0][column]", "period");
  params.set("sort[0][direction]", "desc");
  params.set("length", "12");
  return params;
}

function parseEIADataRows(rows = []) {
  const byProduct = {};
  for (const row of rows) {
    if (!row?.product || byProduct[row.product]) continue;
    const value = parseFloat(row.value);
    if (!Number.isFinite(value)) continue;
    byProduct[row.product] = { value, period: row.period };
  }
  return {
    regular: byProduct.EPMR?.value ?? null,
    premium: byProduct.EPMP?.value ?? null,
    diesel: byProduct.EPD2D?.value ?? null,
    period: byProduct.EPMR?.period || byProduct.EPD2D?.period || null,
  };
}

function formatGalPrice(dollars) {
  if (!Number.isFinite(dollars)) return null;
  return `$${dollars.toFixed(2)}/gal`;
}

async function requestEIAPrices(apiKey) {
  const params = buildEIAQuery();
  if (apiKey) params.set("api_key", apiKey);
  const res = await fetch(`${EIA_DATA_URL}?${params}`);
  const json = await res.json();
  return { res, json };
}

async function fetchEIAFuelPrices() {
  if (eiaPriceCache && Date.now() - eiaPriceCache.fetchedAt < EIA_CACHE_TTL_MS) {
    return eiaPriceCache;
  }

  try {
    const apiKey = process.env.EIA_API_KEY?.trim() || "DEMO_KEY";
    const { res, json } = await requestEIAPrices(apiKey);
    if (!res.ok || json.error) {
      console.warn("EIA fuel price fetch failed:", json.error?.message || res.status);
      return eiaPriceCache || null;
    }

    const parsed = parseEIADataRows(json.response?.data);
    if (parsed.regular == null && parsed.diesel == null) {
      console.warn("EIA fuel price fetch returned no usable rows");
      return eiaPriceCache || null;
    }

    eiaPriceCache = {
      fetchedAt: Date.now(),
      regular: parsed.regular ?? FALLBACK_EIA.regular,
      premium: parsed.premium ?? (parsed.regular != null ? parsed.regular + 0.6 : FALLBACK_EIA.premium),
      diesel: parsed.diesel ?? FALLBACK_EIA.diesel,
      period: parsed.period,
      source: "eia",
    };
    return eiaPriceCache;
  } catch (err) {
    console.warn("EIA fuel price fetch error:", err.message);
    return eiaPriceCache || null;
  }
}

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

  const { stations = [], mode = "gas" } = req.body;
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
