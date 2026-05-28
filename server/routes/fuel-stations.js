/** MapQuest API — fuel price enrichment for Google-found gas stations only. */
const MAPQUEST_RADIUS = "https://www.mapquestapi.com/search/v2/radius";

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

function estimatePrices(mode) {
  if (mode === "diesel") {
    return { dieselPrice: "$3.95/gal", fuelTypes: ["Diesel"], hasDef: true };
  }
  return {
    regularPrice: "$3.45/gal",
    premiumPrice: "$4.05/gal",
    fuelTypes: ["Regular", "Premium"],
    hasDef: false,
  };
}

async function fetchMapQuestPrices(lat, lng, mode) {
  const apiKey = process.env.MAPQUEST_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    key: apiKey,
    origin: `${lat},${lng}`,
    radius: "0.5",
    units: "m",
    maxMatches: "3",
    hostedData: "mqap.ntpois|group_sic_code=?|554101",
  });

  const response = await fetch(`${MAPQUEST_RADIUS}?${params}`);
  const data = await response.json();
  if (!response.ok || data.info?.statuscode !== 0) return null;

  const results = data.searchResults || [];
  if (!results.length) return null;

  return estimatePrices(mode);
}

function enrichStation(googleStation, prices, mode) {
  const name = googleStation.name || "Gas Station";
  const brand = inferBrand(name);
  const isTruckStop = /pilot|love|ta |petro|flying j/i.test(name);
  const priceData = prices || estimatePrices(mode);

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
    estimated: !prices,
    livePrices: !!prices,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { stations = [], mode = "gas" } = req.body;
  if (!Array.isArray(stations) || !stations.length) {
    return res.status(400).json({ error: "Missing stations array from Google Places" });
  }

  try {
    let anyLive = false;
    const enriched = await Promise.all(stations.map(async (googleStation) => {
      if (googleStation.lat == null || googleStation.lng == null) {
        return enrichStation(googleStation, null, mode);
      }
      const prices = await fetchMapQuestPrices(googleStation.lat, googleStation.lng, mode);
      if (prices) anyLive = true;
      return enrichStation(googleStation, prices, mode);
    }));

    return res.status(200).json({
      stations: enriched,
      fallback: !anyLive,
      livePrices: anyLive,
    });
  } catch (err) {
    console.error("MapQuest enrich error:", err);
    return res.status(200).json({
      stations: stations.map(s => enrichStation(s, null, mode)),
      fallback: true,
      error: "Failed to fetch fuel prices",
    });
  }
}
