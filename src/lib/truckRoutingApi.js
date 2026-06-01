/** Client helpers for HERE truck routing API. */
import { getEffectiveVehicle, isTruckVehicle } from "./vehicles.js";

function parseHeightFeetFromAnswers(answers) {
  const h = answers?.truck_height;
  if (!h) return 13.5;
  const match = String(h).match(/(\d+)['′]\s*(\d+)/);
  if (match) return parseInt(match[1], 10) + parseInt(match[2], 10) / 12;
  const n = parseFloat(String(h).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 13.5;
}

function parseWeightLbsFromAnswers(answers) {
  const w = answers?.truck_weight;
  if (!w) return 80000;
  const n = parseFloat(String(w).replace(/,/g, "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 80000;
}

export function shouldUseTruckRouting(answers) {
  return isTruckVehicle(getEffectiveVehicle(answers));
}

export function buildTruckRoutingPayload(origin, destination, answers = {}) {
  const hazmat = answers.truck_hazmat === "Yes"
    || answers.truck_hazmat === true
    || answers.hauling_type?.toLowerCase?.().includes("hazmat")
    || answers.hauling_type?.toLowerCase?.().includes("tanker");

  return {
    origin,
    destination,
    heightFeet: parseHeightFeetFromAnswers(answers),
    weightLbs: parseWeightLbsFromAnswers(answers),
    axleCount: 5,
    hazmat,
  };
}

export async function fetchTruckRoute(origin, destination, answers = {}, { signal } = {}) {
  const payload = buildTruckRoutingPayload(origin, destination, answers);
  const res = await fetch("/api/truck-routing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid truck routing response");
  }
  if (!res.ok) {
    throw new Error(data.error || "Truck routing failed");
  }
  return data;
}

export function truckRestrictionsToTips(restrictions = []) {
  return restrictions
    .filter(r => r.message)
    .map(r => {
      const road = r.roadName ? ` on ${r.roadName}` : "";
      const type = r.type && r.type !== "restriction" ? ` (${r.type})` : "";
      return `Truck restriction${type}${road}: ${r.message}`;
    });
}

export function weighStationsToRoadStops(stations = []) {
  return stations.map((ws, idx) => ({
    id: ws.id || `weigh-${idx}`,
    name: ws.name || "Weigh station",
    location: ws.location || "",
    city: ws.location || "",
    lat: ws.lat,
    lng: ws.lng,
    category: "weigh_station",
    type: "Weigh station",
    hours: ws.hours || null,
    source: "here",
    userAdded: false,
  }));
}
