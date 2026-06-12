/** EV charging detection and road-stop category assignment. */

const CHARGING_NETWORK_RE = /electrify\s*america|tesla\s*supercharger|chargepoint|evgo|blink|nrel/i;

const RESTAURANT_CHAIN_RE = /^(subway|mcdonald'?s?|starbucks|wendy'?s?|burger\s*king|taco\s*bell|chipotle|panda\s*express)$/i;

export function stationTypes(rs) {
  const raw = rs?.types || rs?.placeTypes || rs?.stopData?.types || [];
  return Array.isArray(raw) ? raw.map(t => String(t).toLowerCase()) : [];
}

export function isEvChargingStop(rs) {
  if (!rs) return false;
  const types = stationTypes(rs);
  if (types.some(t => t.includes("electric_vehicle_charging"))) return true;

  const cat = String(rs.category || "").toLowerCase();
  if (cat === "charging" || /^ev\b/.test(cat) || /charg/.test(cat)) return true;

  const network = String(rs.network || rs.stopData?.network || "");
  if (CHARGING_NETWORK_RE.test(network)) return true;

  const name = String(rs.name || rs.title || "");
  if (CHARGING_NETWORK_RE.test(name)) return true;
  if (/\b(dc fast|level\s*2|supercharger|ev\s*charg)/i.test(name)) return true;

  if (rs.chargerTypes?.length || rs.chargeTime80 || rs.ports != null) return true;
  if (rs.stopData?.chargerTypes?.length || rs.stopData?.chargeTime80) return true;

  return false;
}

/** Reject restaurant name collisions (e.g. Subway sandwich shop) from EV results. */
export function isPlausibleEvChargingStation(station) {
  if (!station) return false;
  const types = stationTypes(station);
  if (types.length && !types.some(t => t.includes("electric_vehicle_charging"))) {
    return false;
  }
  const name = String(station.name || "").trim();
  if (RESTAURANT_CHAIN_RE.test(name) && !CHARGING_NETWORK_RE.test(name)) {
    return false;
  }
  if (/^subway$/i.test(name) && !CHARGING_NETWORK_RE.test(name)) return false;

  const addr = String(station.address || station.location || "").trim();
  const hasStreetAddress = /\d/.test(addr) && addr.length > 8 && addr !== "Along route" && addr !== "Near route";
  const hasChargingMeta = Boolean(
    station.chargerTypes?.length
    || station.chargeTime80
    || station.network
    || station.nrelId
    || CHARGING_NETWORK_RE.test(name),
  );
  if (!hasStreetAddress && !hasChargingMeta && !types.some(t => t.includes("electric_vehicle_charging"))) {
    return false;
  }
  return true;
}

export function inferRoadStopCategory(rs) {
  if (isEvChargingStop(rs)) return "Charging";

  const cat = String(rs.category || "").toLowerCase();
  if (/fuel|gas|diesel/.test(cat)) return "Fuel";
  if (/food|dining|meal/.test(cat)) return "Food";
  if (/discovery|attraction|scenic/.test(cat)) return "Discovery";
  if (/rest|break/.test(cat)) return "Rest";
  if (/fuel|pilot|love'?s|shell|chevron|ta\b/i.test(rs.name || "")) return "Fuel";
  if (/mcdonald|starbucks|restaurant|diner|food/i.test(rs.name || rs.note || "")) return "Food";
  return "Rest";
}

export function chargingStopDetails(rs) {
  const data = rs?.stopData || rs;
  const network = data.network || data.brand || null;
  const chargerTypes = data.chargerTypes || [];
  const level = chargerTypes.includes("DC Fast Charge")
    ? "DC Fast"
    : chargerTypes.includes("Level 2")
      ? "Level 2"
      : chargerTypes[0] || null;
  return {
    network,
    level,
    chargeTime80: data.chargeTime80 || null,
    ports: data.ports ?? null,
  };
}
