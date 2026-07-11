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
  "Rental Car": 28,
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

export const EV_CHARGE_INTERVAL_MILES = 200;

export function getVehicleMpg(vehicle) {
  return VEHICLE_MPG[vehicle] ?? 28;
}

export function getFuelStopMode(answers) {
  const vehicle = getEffectiveVehicle(answers);
  if (isWaterVehicle(vehicle) || vehicle === "Plane") return "none";
  if (isRvVehicle(vehicle)) return "rv";
  if (isTruckVehicle(vehicle)) return "diesel";
  const personal = ["Car", "Motorcycle", "SUV or Van", "Rental Car"].includes(vehicle);
  const fuelType = answers?.fuel_type || answers?.fuel;
  if (personal && fuelType === "Hybrid") return "hybrid";
  if (personal && (fuelType === "Electric" || fuelType === "Electric (EV)" || fuelType === "Electric — Tesla Superchargers" || fuelType === "Electric — Tesla Superchargers only")) return "ev";
  if (personal && fuelType === "Diesel") return "diesel";
  return "gas";
}

export function estimateTripFuelCost(miles, answers) {
  if (!miles || miles <= 0) return null;
  const vehicle = getEffectiveVehicle(answers);
  const fuelType = answers?.fuel_type || answers?.fuel;
  if (isWaterVehicle(vehicle) || vehicle === "Plane") return 0;

  if (fuelType === "Electric" || fuelType === "Electric (EV)" || fuelType === "Electric — Tesla Superchargers" || fuelType === "Electric — Tesla Superchargers only") {
    return Math.round(miles * FUEL_PRICES.evPerMile);
  }
  if (fuelType === "Hybrid") {
    const gasPart = (miles * 0.6) / getVehicleMpg(vehicle) * FUEL_PRICES.regular;
    const evPart = (miles * 0.4) * FUEL_PRICES.evPerMile;
    return Math.round(gasPart + evPart);
  }

  const mode = getFuelStopMode(answers);
  if (mode === "none") return 0;
  const mpg = getVehicleMpg(vehicle);
  const price = mode === "diesel" || fuelType === "Diesel" ? FUEL_PRICES.diesel : FUEL_PRICES.regular;
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

/** Sample GPS points every N miles along the actual route polyline. */
export function sampleRoutePointsEveryMiles(path, intervalMiles = 30) {
  const encoded = encodeRoutePoints(path);
  if (!encoded.length) return [];
  if (encoded.length === 1) return encoded;

  const samples = [encoded[0]];
  let sinceLast = 0;

  for (let i = 1; i < encoded.length; i++) {
    sinceLast += milesBetweenPoints(encoded[i - 1], encoded[i]);
    while (sinceLast >= intervalMiles) {
      samples.push(encoded[i]);
      sinceLast -= intervalMiles;
    }
  }

  const last = encoded[encoded.length - 1];
  const prev = samples[samples.length - 1];
  if (prev.lat !== last.lat || prev.lng !== last.lng) samples.push(last);
  return samples;
}

export function routePointAtFraction(path, fraction) {
  const encoded = encodeRoutePoints(path);
  if (!encoded.length) return null;
  const idx = Math.floor(Math.max(0, Math.min(1, fraction)) * (encoded.length - 1));
  return encoded[idx];
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
  return stations.toSorted((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
}

export function takeClosest(stations, max = 3) {
  return sortByDistance(stations).slice(0, max);
}

/** Preferred truck stop / fuel brand from the question flow (null = no preference). */
export function getPreferredFuelBrand(answers) {
  const brand = answers?.truck_stop_brand || answers?.truck_stop_preference;
  if (!brand || brand === "No preference") return null;
  return brand;
}

/** Match a station name to the user's preferred fuel brand. */
export function matchesPreferredFuelBrand(name, brand) {
  if (!brand || brand === "No preference") return true;
  const n = String(name || "").toLowerCase();
  const b = brand.toLowerCase();
  if (b.includes("pilot") || b.includes("flying j")) return n.includes("pilot") || n.includes("flying j");
  if (b.includes("love")) return n.includes("love");
  if (b.includes("petro")) return n.includes("petro");
  if (b.includes("ta travel")) return n.includes("ta ") || n.startsWith("ta ") || n.includes("travel center");
  if (b.includes("allsup")) return n.includes("allsup");
  return n.includes(b.split(/[\s']/)[0]);
}

export function isFuelCategoryRoadStop(stop) {
  const cat = (stop?.category || "").toLowerCase();
  const name = (stop?.name || stop?.title || "").toLowerCase();
  const blob = `${cat} ${name}`;
  return cat === "fuel"
    || cat === "charging"
    || /gas station|fuel|diesel|truck stop|pilot|love'?s|petro|allsup|flying j|ta travel|chevron|shell|bp\b|marathon|speedway|casey/i.test(blob);
}

/** Rough count of fuel stops needed for a route based on vehicle range. */
export function getFuelStopIntervalCount(answers, totalMiles, overnightStopCount = 0) {
  const mode = getFuelStopMode(answers);
  if (mode === "none" || !totalMiles || totalMiles <= 0) {
    return Math.max(1, overnightStopCount + 1);
  }
  if (mode === "ev" || mode === "hybrid") {
    return Math.max(overnightStopCount + 1, Math.ceil(totalMiles / EV_CHARGE_INTERVAL_MILES));
  }
  const mpg = getVehicleMpg(getEffectiveVehicle(answers));
  const isTruck = mode === "diesel";
  const tankRange = isTruck ? mpg * 120 : mpg * 12;
  const stopRange = Math.max(100, Math.min(280, tankRange * 0.75));
  const byRange = Math.max(1, Math.ceil(totalMiles / stopRange));
  return Math.max(overnightStopCount + 1, byRange);
}

function estimateStopRouteMile(stop, routePoints, totalMiles) {
  if (!routePoints?.length || stop?.lat == null || stop?.lng == null) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  routePoints.forEach((pt, idx) => {
    const d = milesBetweenPoints(stop, pt);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  });
  const fraction = routePoints.length > 1 ? bestIdx / (routePoints.length - 1) : 0;
  return fraction * (totalMiles || 0);
}

/** Keep one preferred-brand fuel stop per logical fuel interval; drop competing brands when set. */
export function consolidateFuelRoadStops(roadStops, answers, routeInfo, overnightStopCount = 0) {
  if (!roadStops?.length) return roadStops;

  const nonFuel = roadStops.filter(rs => !isFuelCategoryRoadStop(rs));
  let fuel = roadStops.filter(rs => isFuelCategoryRoadStop(rs));
  const brand = getPreferredFuelBrand(answers);

  if (brand) {
    fuel = fuel.filter(rs => matchesPreferredFuelBrand(rs.name || rs.title || rs.location, brand));
  }

  const routePoints = routeInfo?.routePoints;
  const totalMiles = parseMilesFromDistance(routeInfo?.distance) || 0;
  if (!routePoints?.length || fuel.length <= 1) {
    return [...nonFuel, ...fuel];
  }

  const intervalCount = getFuelStopIntervalCount(answers, totalMiles, overnightStopCount);
  const intervalMiles = Math.max(80, totalMiles / intervalCount);
  const buckets = new Map();

  fuel.forEach(stop => {
    if (stop.lat == null || stop.lng == null) {
      const loose = buckets.get(-1) || [];
      loose.push({ stop, mile: 0, distance: stop.distanceMiles ?? 99 });
      buckets.set(-1, loose);
      return;
    }
    const mile = estimateStopRouteMile(stop, routePoints, totalMiles);
    const bucket = Math.floor(mile / intervalMiles);
    const list = buckets.get(bucket) || [];
    list.push({ stop, mile, distance: stop.distanceMiles ?? 99 });
    buckets.set(bucket, list);
  });

  const pickedFuel = [];
  [...buckets.keys()].sort((a, b) => a - b).forEach(key => {
    const list = buckets.get(key);
    list.sort((a, b) => a.distance - b.distance || a.mile - b.mile);
    if (list[0]?.stop) pickedFuel.push(list[0].stop);
  });

  return [...nonFuel, ...pickedFuel];
}

export function filterStationsByPreferredBrand(stations, answers) {
  const brand = getPreferredFuelBrand(answers);
  if (!brand || !stations?.length) return stations;
  return stations.filter(s => matchesPreferredFuelBrand(s.name || s.brand, brand));
}

/** Keep fuel stations within maxMiles of the route sample point (default 1 mi on-route). */
export function selectOnRouteFuelStations(stations, maxMiles = 1) {
  const onRoute = stations.filter(s => (s.distanceMiles ?? 99) <= maxMiles);
  return onRoute.length ? onRoute : sortByDistance(stations).slice(0, 3);
}

export { markBestPriceFuelStations } from "./placesFilters.js";

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
  const cost = estimateStopCost({ category, ...stop }, type);
  return {
    id: stop.id || `stop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    location: stop.address || stop.name,
    distance: `${stop.distanceMiles?.toFixed(1) ?? "—"} mi`,
    eta: "—",
    category,
    name: stop.name,
    note: stop.estimated ? "Estimated — live prices unavailable" : "Added from fuel planner",
    diesel: stop.dieselPrice,
    fuel: stop.regularPrice || stop.chargerTypes?.join(", "),
    estimatedCost: cost,
    userAdded: true,
  };
}

export function parsePriceString(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

export function estimateStopCost(stop, type) {
  if (stop.estimatedCost != null) return stop.estimatedCost;
  if (type === "ev" || stop.category === "charging") return 18;
  if (type === "propane") return 35;
  const diesel = parsePriceString(stop.dieselPrice);
  const regular = parsePriceString(stop.regularPrice);
  if (diesel) return Math.round(diesel * 25);
  if (regular) return Math.round(regular * 15);
  if (stop.category === "food") return 28;
  if (stop.category === "rest") return 0;
  return 15;
}
