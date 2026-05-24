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
