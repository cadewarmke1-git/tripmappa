/** Frontend API layer — always call serverless routes, never Anthropic directly. */
export async function generateTripPlan(payload) {
  const response = await fetch("/api/plan-trip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to generate trip");
  }
  return data;
}

export async function fetchFuelStations(latitude, longitude, mode = "gas") {
  const response = await fetch("/api/fuel-stations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude, mode }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Fuel station lookup failed");
  return data;
}

export async function fetchEvCharging(latitude, longitude, fuelType = "ELEC") {
  const response = await fetch("/api/ev-charging", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude, fuelType }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "EV charging lookup failed");
  return data;
}
