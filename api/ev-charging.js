/** NREL Alternative Fuels Station API — EV charging and propane. */
const NREL_BASE = "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json";

function parseChargerTypes(station) {
  const types = new Set();
  const evLevel = station.ev_level1_evse_num > 0 ? "Level 1" : null;
  const evL2 = station.ev_level2_evse_num > 0 ? "Level 2" : null;
  const evDc = station.ev_dc_fast_num > 0 ? "DC Fast Charge" : null;
  [evLevel, evL2, evDc].filter(Boolean).forEach(t => types.add(t));
  if (station.ev_connector_types) {
    String(station.ev_connector_types).split(",").forEach(c => {
      const t = c.trim();
      if (/CHADEMO|CCS|J1772COMBO|NEMA/i.test(t)) types.add("DC Fast Charge");
      else if (/J1772/i.test(t)) types.add("Level 2");
    });
  }
  if (!types.size) types.add("Level 2");
  return [...types];
}

function parseNetwork(station) {
  if (station.ev_network) return station.ev_network;
  const name = (station.station_name || "").toLowerCase();
  if (name.includes("tesla")) return "Tesla";
  if (name.includes("chargepoint")) return "ChargePoint";
  if (name.includes("electrify")) return "Electrify America";
  if (name.includes("evgo")) return "EVgo";
  return "Other";
}

function countPorts(station) {
  return (station.ev_level1_evse_num || 0)
    + (station.ev_level2_evse_num || 0)
    + (station.ev_dc_fast_num || 0)
    || 2;
}

function estimateChargeTime(chargerTypes) {
  if (chargerTypes.includes("DC Fast Charge")) return "~30 min";
  if (chargerTypes.includes("Level 2")) return "~4 hrs";
  return "~6 hrs";
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { latitude, longitude, fuelType = "ELEC" } = req.body;
  if (latitude == null || longitude == null) {
    return res.status(400).json({ error: "Missing latitude or longitude" });
  }

  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ stations: [], fallback: true, error: "NREL_API_KEY not configured" });
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    latitude: String(latitude),
    longitude: String(longitude),
    radius: "5",
    fuel_type: fuelType,
    status: "E",
    limit: "10",
  });

  try {
    const response = await fetch(`${NREL_BASE}?${params}`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ stations: [], fallback: true, error: data.errors?.[0] || "NREL API error" });
    }

    const stations = (data.fuel_stations || []).map(s => {
      const chargerTypes = fuelType === "LPG" ? ["Propane"] : parseChargerTypes(s);
      const dist = s.latitude && s.longitude
        ? haversineMiles(latitude, longitude, s.latitude, s.longitude)
        : s.distance || null;
      return {
        id: `nrel-${s.id}`,
        name: s.station_name || "Charging Station",
        address: [s.street_address, s.city, s.state].filter(Boolean).join(", "),
        network: fuelType === "LPG" ? (s.station_name || "Propane") : parseNetwork(s),
        chargerTypes,
        fuelTypes: fuelType === "LPG" ? ["Propane"] : chargerTypes,
        ports: countPorts(s),
        distanceMiles: dist != null ? Math.round(dist * 10) / 10 : null,
        chargeTime80: fuelType === "LPG" ? null : estimateChargeTime(chargerTypes),
        lat: s.latitude,
        lng: s.longitude,
        estimated: false,
      };
    }).sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));

    return res.status(200).json({ stations, fallback: false });
  } catch (err) {
    console.error("NREL API error:", err);
    return res.status(200).json({ stations: [], fallback: true, error: "Failed to fetch charging stations" });
  }
}
