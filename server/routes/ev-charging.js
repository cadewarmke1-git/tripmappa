/** NREL primary EV/LPG discovery with optional Google-station enrichment. */
import { guardProxyRoute } from "../lib/apiSecurity.js";
import { isPlausibleEvChargingStation } from "../../src/lib/roadStopCategory.js";
import {
  fetchNrelNearest,
  filterTeslaStations,
  haversineMiles,
  mapNrelStationToCard,
  parseChargerTypes,
  parseNetwork,
} from "../lib/nrelEv.js";

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

function enrichGoogleStation(googleStation, nrelMatch, fuelType) {
  const base = {
    id: googleStation.id || googleStation.placeId,
    placeId: googleStation.placeId || null,
    name: googleStation.name,
    address: googleStation.address,
    lat: googleStation.lat,
    lng: googleStation.lng,
    distanceMiles: googleStation.distanceMiles,
    source: "google",
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

  const {
    discover = false,
    lat,
    lng,
    radius = 5,
    stations = [],
    fuelType = "ELEC",
    teslaOnly = false,
  } = req.body || {};

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (discover) {
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return res.status(400).json({ error: "lat and lng are required for discovery" });
    }
    if (!process.env.NREL_API_KEY) {
      return res.status(200).json({ stations: [], source: "nrel", fallback: true, error: "NREL_API_KEY not configured" });
    }
    try {
      let nrelRaw = await fetchNrelNearest(latNum, lngNum, fuelType, radius, 12);
      if (teslaOnly && fuelType === "ELEC") {
        nrelRaw = nrelRaw.filter(s => /tesla/i.test(`${s.ev_network || ""} ${s.station_name || ""}`));
      }
      let mapped = nrelRaw.map(s => mapNrelStationToCard(s, latNum, lngNum, fuelType));
      if (fuelType === "ELEC") {
        mapped = mapped.filter(s => isPlausibleEvChargingStation(s));
      }
      return res.status(200).json({ stations: mapped, source: "nrel", fallback: false });
    } catch (err) {
      console.error("NREL discover error:", err);
      return res.status(200).json({ stations: [], source: "nrel", fallback: true, error: "Failed to discover charging stations" });
    }
  }

  if (!Array.isArray(stations) || !stations.length || stations.length > 30) {
    return res.status(400).json({ error: "Missing stations array" });
  }

  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) {
    const fallbackStations = stations
      .map(s => enrichGoogleStation(s, null, fuelType))
      .filter(s => fuelType === "LPG" || isPlausibleEvChargingStation(s));
    return res.status(200).json({
      stations: teslaOnly
        ? filterTeslaStations(fallbackStations)
        : fallbackStations,
      source: "google",
      fallback: true,
      error: "NREL_API_KEY not configured",
    });
  }

  try {
    const enriched = await Promise.all(stations.map(async (googleStation) => {
      if (googleStation.lat == null || googleStation.lng == null) {
        return enrichGoogleStation(googleStation, null, fuelType);
      }
      const nrelNearby = await fetchNrelNearest(googleStation.lat, googleStation.lng, fuelType, 1, 5);
      const match = matchNrelStation(googleStation, nrelNearby);
      return enrichGoogleStation(googleStation, match, fuelType);
    }));

    const validated = enriched.filter(s => fuelType === "LPG" || isPlausibleEvChargingStation(s));
    const filtered = teslaOnly ? filterTeslaStations(validated) : validated;

    return res.status(200).json({ stations: filtered, source: "google", fallback: false });
  } catch (err) {
    console.error("NREL enrich error:", err);
    return res.status(200).json({
      stations: stations.map(s => enrichGoogleStation(s, null, fuelType)),
      source: "google",
      fallback: true,
      error: "Failed to enrich charging stations",
    });
  }
}
