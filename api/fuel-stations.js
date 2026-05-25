/** MapQuest Search API — gas and diesel stations near a route point. */
const MAPQUEST_RADIUS = "https://www.mapquestapi.com/search/v2/radius";

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { latitude, longitude, mode = "gas" } = req.body;
  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: "Missing latitude or longitude" });
  }

  const apiKey = process.env.MAPQUEST_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ stations: [], fallback: true, error: "MAPQUEST_API_KEY not configured" });
  }

  const params = new URLSearchParams({
    key: apiKey,
    origin: `${latitude},${longitude}`,
    radius: "5",
    units: "m",
    maxMatches: "15",
    hostedData: "mqap.ntpois|group_sic_code=?|554101",
  });

  try {
    const response = await fetch(`${MAPQUEST_RADIUS}?${params}`);
    const data = await response.json();

    if (!response.ok || data.info?.statuscode !== 0) {
      return res.status(200).json({
        stations: [],
        fallback: true,
        error: data.info?.messages?.[0] || "MapQuest API error",
      });
    }

    const results = data.searchResults || [];
    const prices = estimatePrices(mode);

    const stations = results.map((r, i) => {
      const lat = r.fields?.lat ?? r.latLng?.lat;
      const lng = r.fields?.lng ?? r.latLng?.lng;
      const dist = r.distance ?? (lat && lng ? haversineMiles(latitude, longitude, lat, lng) : null);
      const name = r.name || r.fields?.name || "Gas Station";
      const brand = inferBrand(name);
      const isTruckStop = /pilot|love|ta |petro|flying j/i.test(name);

      return {
        id: `mq-${r.fields?.mq_id || i}`,
        name,
        brand,
        address: [r.fields?.address, r.fields?.city, r.fields?.state].filter(Boolean).join(", ")
          || r.formattedAddress
          || "Along route",
        distanceMiles: dist != null ? Math.round(Number(dist) * 10) / 10 : null,
        ...prices,
        hasDef: mode === "diesel" || isTruckStop,
        lat,
        lng,
        estimated: true,
        livePrices: false,
      };
    }).sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));

    return res.status(200).json({ stations, fallback: false, livePrices: false });
  } catch (err) {
    console.error("MapQuest API error:", err);
    return res.status(200).json({ stations: [], fallback: true, error: "Failed to fetch fuel stations" });
  }
}
