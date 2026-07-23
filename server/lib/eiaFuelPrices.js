/** EIA regional ground-fuel averages — shared by fuel-stations enrichment. */

const EIA_DATA_URL = "https://api.eia.gov/v2/petroleum/pri/gnd/data";
const EIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EIA_PRODUCTS = ["EPMR", "EPMP", "EPD2D"];

export const FALLBACK_EIA = {
  regular: 3.45,
  premium: 4.05,
  diesel: 3.95,
};

/** PADD duoarea codes used by EIA petroleum/pri/gnd. */
export const EIA_PADD_AREAS = {
  R10: { label: "east", duoarea: "R10" },
  R20: { label: "midwest", duoarea: "R20" },
  R30: { label: "gulf", duoarea: "R30" },
  R40: { label: "rockies", duoarea: "R40" },
  R50: { label: "west", duoarea: "R50" },
  NUS: { label: "us", duoarea: "NUS" },
};

const priceCacheByArea = new Map();

function buildEIAQuery(duoarea) {
  const params = new URLSearchParams();
  params.set("frequency", "weekly");
  params.append("data[0]", "value");
  params.append("facets[duoarea][]", duoarea);
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

async function requestEIAPrices(apiKey, duoarea) {
  const params = buildEIAQuery(duoarea);
  if (apiKey) params.set("api_key", apiKey);
  const res = await fetch(`${EIA_DATA_URL}?${params}`);
  const json = await res.json();
  return { res, json };
}

/**
 * Map coordinates to an EIA PADD region. Crude but stable for corridor price spreads.
 * Never throws — unknown coords → NUS.
 */
export function paddFromCoords(lat, lng) {
  if (lat == null || lng == null) return "NUS";
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return "NUS";
  if (lngNum < -114) return "R50";
  if (lngNum < -104) return "R40";
  if (lngNum < -90) return latNum < 37 ? "R30" : "R20";
  return "R10";
}

export function formatGalPrice(dollars) {
  if (!Number.isFinite(dollars)) return null;
  return `$${dollars.toFixed(2)}/gal`;
}

export async function fetchEIAFuelPricesForArea(areaCode = "NUS") {
  const code = EIA_PADD_AREAS[areaCode] ? areaCode : "NUS";
  const cached = priceCacheByArea.get(code);
  if (cached && Date.now() - cached.fetchedAt < EIA_CACHE_TTL_MS) {
    return cached;
  }

  try {
    const apiKey = process.env.EIA_API_KEY?.trim() || "DEMO_KEY";
    const duoarea = EIA_PADD_AREAS[code].duoarea;
    const { res, json } = await requestEIAPrices(apiKey, duoarea);
    if (!res.ok || json.error) {
      console.warn("EIA fuel price fetch failed:", code, json.error?.message || res.status);
      return cached || null;
    }

    const parsed = parseEIADataRows(json.response?.data);
    if (parsed.regular == null && parsed.diesel == null) {
      console.warn("EIA fuel price fetch returned no usable rows:", code);
      return cached || null;
    }

    const entry = {
      fetchedAt: Date.now(),
      area: code,
      label: EIA_PADD_AREAS[code].label,
      regular: parsed.regular ?? FALLBACK_EIA.regular,
      premium: parsed.premium ?? (parsed.regular != null ? parsed.regular + 0.6 : FALLBACK_EIA.premium),
      diesel: parsed.diesel ?? FALLBACK_EIA.diesel,
      period: parsed.period,
      source: "eia",
    };
    priceCacheByArea.set(code, entry);
    return entry;
  } catch (err) {
    console.warn("EIA fuel price fetch error:", code, err.message);
    return cached || null;
  }
}

/** National average — preserves prior fuel-stations behavior. */
export async function fetchEIAFuelPrices() {
  return fetchEIAFuelPricesForArea("NUS");
}

/**
 * Resolve regional prices for corridor sample points.
 * Failures per-point fall back to null (caller degrades gracefully).
 */
export async function fetchRegionalPricesForPoints(points = []) {
  const uniqueAreas = new Set();
  const resolved = points.map((pt, index) => {
    const id = pt.id != null ? String(pt.id) : `pt-${index}`;
    const area = paddFromCoords(pt.lat, pt.lng);
    uniqueAreas.add(area);
    return { id, area, lat: pt.lat, lng: pt.lng };
  });

  const areaPrices = {};
  await Promise.all([...uniqueAreas].map(async (area) => {
    areaPrices[area] = await fetchEIAFuelPricesForArea(area);
  }));

  const pricesById = {};
  for (const pt of resolved) {
    const eia = areaPrices[pt.area];
    if (!eia) {
      pricesById[pt.id] = null;
      continue;
    }
    pricesById[pt.id] = {
      area: pt.area,
      region: eia.label,
      regular: eia.regular,
      premium: eia.premium,
      diesel: eia.diesel,
      regularPrice: formatGalPrice(eia.regular),
      dieselPrice: formatGalPrice(eia.diesel),
      period: eia.period,
    };
  }
  return pricesById;
}
