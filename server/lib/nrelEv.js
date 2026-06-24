/** NREL Alt Fuel Stations — shared discovery and mapping for EV/LPG. */

export const NREL_BASE = "https://developer.nrel.gov/api/alt-fuel-stations/v1/nearest.json";

export function parseChargerTypes(station) {
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

export function parseNetwork(station) {
  if (station.ev_network) return station.ev_network;
  const name = (station.station_name || "").toLowerCase();
  if (name.includes("tesla")) return "Tesla";
  if (name.includes("chargepoint")) return "ChargePoint";
  if (name.includes("electrify")) return "Electrify America";
  if (name.includes("evgo")) return "EVgo";
  return "Other";
}

export function countPorts(station) {
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

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchNrelNearest(lat, lng, fuelType, radiusMiles = 5, limit = 10) {
  const apiKey = process.env.NREL_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    api_key: apiKey,
    latitude: String(lat),
    longitude: String(lng),
    radius: String(Math.min(50, Math.max(1, Math.round(radiusMiles)))),
    fuel_type: fuelType,
    status: "E",
    limit: String(Math.min(20, limit)),
  });

  const response = await fetch(`${NREL_BASE}?${params}`);
  const data = await response.json();
  if (!response.ok) return [];
  return data.fuel_stations || [];
}

export function mapNrelStationToCard(nrel, originLat, originLng, fuelType = "ELEC") {
  const lat = Number(nrel.latitude);
  const lng = Number(nrel.longitude);
  const distanceMiles = Number.isFinite(lat) && Number.isFinite(lng)
    ? Math.round(haversineMiles(originLat, originLng, lat, lng) * 10) / 10
    : null;
  const name = nrel.station_name || "EV Charging Station";
  const address = [nrel.street_address, nrel.city, nrel.state]
    .filter(Boolean)
    .join(", ") || "Along route";

  if (fuelType === "LPG") {
    return {
      id: `nrel-${nrel.id}`,
      placeId: null,
      name,
      address,
      lat,
      lng,
      distanceMiles,
      network: name,
      fuelTypes: ["Propane"],
      chargerTypes: ["Propane"],
      source: "nrel",
      nrelId: nrel.id,
      estimated: false,
    };
  }

  const chargerTypes = parseChargerTypes(nrel);
  return {
    id: `nrel-${nrel.id}`,
    placeId: null,
    name,
    address,
    lat,
    lng,
    distanceMiles,
    network: parseNetwork(nrel),
    chargerTypes,
    fuelTypes: chargerTypes,
    ports: countPorts(nrel),
    chargeTime80: estimateChargeTime(chargerTypes),
    availability: nrel.ev_renewable_source || null,
    nrelId: nrel.id,
    source: "nrel",
    estimated: false,
  };
}

export function filterTeslaStations(stations) {
  return stations.filter(s => /tesla/i.test(s.network || s.name || ""));
}
