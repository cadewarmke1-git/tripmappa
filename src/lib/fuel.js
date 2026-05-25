import { parseMilesFromDistance } from "./parsing.js";
import {
  getEffectiveVehicle,
  isTruckVehicle,
  isRvVehicle,
  isWaterVehicle,
  inferFuelType,
  hasPref,
} from "./vehicles.js";

export const VEHICLE_MPG = {
  Car: 30,
  Motorcycle: 45,
  "SUV or Van": 22,
  RV: 10,
  "Camper Van": 18,
  "Semi Truck (18-wheeler)": 6.5,
  "Box Truck": 12,
  Flatbed: 7,
  Tanker: 6,
};

export const FUEL_PRICES = {
  regular: 3.45,
  premium: 4.05,
  diesel: 3.95,
  e85: 3.15,
  evPerMile: 0.15,
};

export const EV_RANGE_MILES = 250;
export const EV_CHARGE_INTERVAL_MILES = 200;

export function getVehicleMpg(vehicle) {
  return VEHICLE_MPG[vehicle] ?? 28;
}

export function getFuelStopMode(answers) {
  const vehicle = getEffectiveVehicle(answers);
  if (isWaterVehicle(vehicle) || vehicle === "Plane") return "none";
  if (isRvVehicle(vehicle)) return "rv";
  if (isTruckVehicle(vehicle)) return "diesel";
  const personal = ["Car", "Motorcycle", "SUV or Van"].includes(vehicle);
  if (personal && hasPref(answers, "EV charging stops")) return "hybrid";
  if (personal && inferFuelType(vehicle, answers.preferences || []) === "Electric (EV)") return "ev";
  return "gas";
}

export function estimateTripFuelCost(miles, answers) {
  if (!miles || miles <= 0) return null;
  const vehicle = getEffectiveVehicle(answers);
  const mode = getFuelStopMode(answers);
  if (mode === "none") return 0;
  if (mode === "ev") return Math.round(miles * FUEL_PRICES.evPerMile);
  if (mode === "hybrid") {
    const gasPart = (miles * 0.6) / getVehicleMpg(vehicle) * FUEL_PRICES.regular;
    const evPart = (miles * 0.4) * FUEL_PRICES.evPerMile;
    return Math.round(gasPart + evPart);
  }
  const mpg = getVehicleMpg(vehicle);
  const price = mode === "diesel" ? FUEL_PRICES.diesel : FUEL_PRICES.regular;
  return Math.round((miles / mpg) * price);
}

export function encodeRoutePoints(path) {
  if (!path?.length) return [];
  return path.map(p => ({
    lat: typeof p.lat === "function" ? p.lat() : p.lat,
    lng: typeof p.lng === "function" ? p.lng() : p.lng,
  }));
}

export function sampleRoutePoints(path, count) {
  if (!path?.length || count < 1) return [];
  const encoded = encodeRoutePoints(path);
  if (encoded.length === 1) return encoded;
  const points = [];
  for (let i = 1; i <= count; i++) {
    const idx = Math.floor((i / (count + 1)) * encoded.length);
    points.push(encoded[Math.min(idx, encoded.length - 1)]);
  }
  return points;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function milesBetweenPoints(a, b) {
  if (!a || !b) return 0;
  return haversineMiles(a.lat, a.lng, b.lat, b.lng);
}

/** Build fuel-interval checkpoints along the route (between overnight stops). */
export function buildFuelIntervalPoints(routePoints, overnightStopCount, totalMiles, answers) {
  if (!routePoints?.length) return [];
  const mode = getFuelStopMode(answers);
  if (mode === "none") return [];

  const intervalCount = Math.max(1, overnightStopCount + 1);
  let basePoints = sampleRoutePoints(routePoints, intervalCount);

  if (mode === "ev" || mode === "hybrid") {
    const miles = totalMiles || 0;
    const segments = [];
    const numSegments = Math.max(1, overnightStopCount + 1);
    const segmentMiles = miles / numSegments;

    for (let s = 0; s < numSegments; s++) {
      const ptIdx = Math.floor(((s + 0.5) / numSegments) * routePoints.length);
      const pt = routePoints[Math.min(ptIdx, routePoints.length - 1)];
      segments.push({ ...pt, required: false, segmentIndex: s });

      if (segmentMiles > EV_CHARGE_INTERVAL_MILES) {
        const midIdx = Math.floor(((s + 0.5) / numSegments) * routePoints.length);
        segments.push({
          ...routePoints[Math.min(midIdx, routePoints.length - 1)],
          required: true,
          segmentIndex: s,
          label: "Required charge stop — segment exceeds 200 mi",
        });
      }
    }
    return dedupeNearbyPoints(segments);
  }

  return basePoints.map((p, i) => ({ ...p, required: false, segmentIndex: i }));
}

function dedupeNearbyPoints(points) {
  const out = [];
  points.forEach(p => {
    const dup = out.find(o => milesBetweenPoints(o, p) < 15);
    if (!dup) out.push(p);
    else if (p.required && !dup.required) {
      const idx = out.indexOf(dup);
      out[idx] = p;
    }
  });
  return out;
}

export function computeSegmentMiles(totalMiles, intervalIndex, intervalCount) {
  if (!totalMiles || intervalCount < 1) return null;
  const segmentMiles = totalMiles / intervalCount;
  return Math.round(segmentMiles * (intervalIndex + 0.5));
}

export function sortByDistance(stations) {
  return [...stations].sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
}

export function takeClosest(stations, max = 3) {
  return sortByDistance(stations).slice(0, max);
}

export function buildFallbackGasStations(lat, lng, mode) {
  const brands = mode === "diesel"
    ? [
      { name: "Pilot Flying J", diesel: FUEL_PRICES.diesel, def: true },
      { name: "Love's Travel Stop", diesel: FUEL_PRICES.diesel, def: true },
      { name: "TA Travel Center", diesel: FUEL_PRICES.diesel, def: false },
    ]
    : [
      { name: "Shell", regular: FUEL_PRICES.regular, premium: FUEL_PRICES.premium },
      { name: "Chevron", regular: FUEL_PRICES.regular + 0.05, premium: FUEL_PRICES.premium + 0.08 },
      { name: "BP", regular: FUEL_PRICES.regular - 0.03, premium: FUEL_PRICES.premium - 0.02 },
    ];

  return brands.map((b, i) => ({
    id: `fallback-gas-${i}`,
    name: b.name,
    brand: b.name,
    address: "Along your route",
    distanceMiles: 1.2 + i * 0.8,
    fuelTypes: mode === "diesel" ? ["Diesel"] : ["Regular", "Premium"],
    regularPrice: b.regular ? `$${b.regular.toFixed(2)}/gal` : null,
    premiumPrice: b.premium ? `$${b.premium.toFixed(2)}/gal` : null,
    dieselPrice: b.diesel ? `$${b.diesel.toFixed(2)}/gal` : null,
    hasDef: b.def || false,
    estimated: true,
    lat,
    lng,
  }));
}

export function buildFallbackEvStations(lat, lng) {
  return [
    {
      id: "fallback-ev-1",
      name: "ChargePoint Station",
      address: "Near route",
      network: "ChargePoint",
      chargerTypes: ["Level 2", "DC Fast Charge"],
      ports: 4,
      distanceMiles: 0.9,
      chargeTime80: "~45 min",
      estimated: true,
      lat,
      lng,
    },
    {
      id: "fallback-ev-2",
      name: "Electrify America",
      address: "Near route",
      network: "Electrify America",
      chargerTypes: ["DC Fast Charge"],
      ports: 6,
      distanceMiles: 1.5,
      chargeTime80: "~30 min",
      estimated: true,
      lat,
      lng,
    },
    {
      id: "fallback-ev-3",
      name: "Tesla Supercharger",
      address: "Near route",
      network: "Tesla",
      chargerTypes: ["DC Fast Charge"],
      ports: 8,
      distanceMiles: 2.1,
      chargeTime80: "~25 min",
      estimated: true,
      lat,
      lng,
    },
  ];
}

export function buildFallbackPropane(lat, lng) {
  return [{
    id: "fallback-propane-1",
    name: "AmeriGas Propane",
    address: "Near route",
    network: "AmeriGas",
    fuelTypes: ["Propane"],
    distanceMiles: 2.4,
    estimated: true,
    lat,
    lng,
  }];
}

export function fuelStopToRoadStop(stop, type) {
  const category = type === "ev" ? "charging" : "fuel";
  return {
    location: stop.address || stop.name,
    distance: `${stop.distanceMiles?.toFixed(1) ?? "—"} mi`,
    eta: "—",
    category,
    name: stop.name,
    note: stop.estimated ? "Estimated — live prices unavailable" : "Added from fuel planner",
    diesel: stop.dieselPrice,
    fuel: stop.regularPrice || stop.chargerTypes?.join(", "),
  };
}
