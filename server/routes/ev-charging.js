/** NREL API — enrich Google-found EV/propane stations with charger details only. */
import { guardProxyRoute } from "../lib/apiSecurity.js";

const NREL_BASE = "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json";

function parseChargerTypes(station) {
  const types = new Set();
  const evL2 = station.ev_level2_evse_num > 0 ? "Level 2" : null;
  const evDc = station.ev_dc_fast_num > 0 ? "DC Fast Charge" : null;
  [evL2, evDc].filter(Boolean).forEach(t => types.add(t));
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

async function fetchNrelNearest(lat, lng, fuelType) {
  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    latitude: String(lat),
    longitude: String(lng),
    radius: "1",
    fuel_type: fuelType,
    status: "E",
    limit: "5",
  });

  const response = await fetch(`${NREL_BASE}?${params}`);
  const data = await response.json();
  if (!response.ok) return [];
  return data.fuel_stations || [];
}

function matchNrelStation(googleStation, nrelStations) {
  if (!nrelStations?.length) return null;
  let best = null;
  let bestDist = Infinity;
  nrelStations.forEach(s => {
    if (!s.latitude || !s.longitude) return;
    const d = haversineMiles(googleStation.lat, googleStation.lng, s.latitude, s.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  });
  return bestDist <= 1.5 ? best : null;
}

function enrichStation(googleStation, nrelMatch, fuelType) {
  const base = {
    id: googleStation.id || googleStation.placeId,
    placeId: googleStation.placeId,
    name: googleStation.name,
    address: googleStation.address,
    lat: googleStation.lat,
    lng: googleStation.lng,
    distanceMiles: googleStation.distanceMiles,
    estimated: !nrelMatch,
  };

  if (fuelType === "LPG") {
    return {
      ...base,
      network: nrelMatch?.station_name || googleStation.name,
      fuelTypes: ["Propane"],
      chargerTypes: ["Propane"],
    };
  }

  if (!nrelMatch) {
    return {
      ...base,
      network: "Unknown",
      chargerTypes: ["Level 2"],
      ports: 2,
      chargeTime80: "~45 min",
      availability: null,
    };
  }

  const chargerTypes = parseChargerTypes(nrelMatch);
  return {
    ...base,
    estimated: false,
    network: parseNetwork(nrelMatch),
    chargerTypes,
    fuelTypes: chargerTypes,
    ports: countPorts(nrelMatch),
    chargeTime80: estimateChargeTime(chargerTypes),
    availability: nrelMatch.ev_renewable_source || null,
    nrelId: nrelMatch.id,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (guardProxyRoute(req, res)) return undefined;

  const { stations = [], fuelType = "ELEC", teslaOnly = false } = req.body;
  if (!Array.isArray(stations) || !stations.length || stations.length > 30) {
    return res.status(400).json({ error: "Missing stations array from Google Places" });
  }

  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      stations: (teslaOnly
        ? stations.map(s => enrichStation(s, null, fuelType)).filter(s => /tesla/i.test(s.network || s.name || ""))
        : stations.map(s => enrichStation(s, null, fuelType))),
      fallback: true,
      error: "NREL_API_KEY not configured",
    });
  }

  try {
    const enriched = await Promise.all(stations.map(async (googleStation) => {
      if (googleStation.lat == null || googleStation.lng == null) {
        return enrichStation(googleStation, null, fuelType);
      }
      const nrelNearby = await fetchNrelNearest(googleStation.lat, googleStation.lng, fuelType);
      const match = matchNrelStation(googleStation, nrelNearby);
      return enrichStation(googleStation, match, fuelType);
    }));

    const filtered = teslaOnly
      ? enriched.filter(s => /tesla/i.test(s.network || s.name || ""))
      : enriched;

    return res.status(200).json({ stations: filtered, fallback: false });
  } catch (err) {
    console.error("NREL enrich error:", err);
    return res.status(200).json({
      stations: stations.map(s => enrichStation(s, null, fuelType)),
      fallback: true,
      error: "Failed to enrich charging stations",
    });
  }
}
