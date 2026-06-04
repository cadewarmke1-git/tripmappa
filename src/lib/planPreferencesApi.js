/** Client API for /api/plan-preferences */

export async function fetchPlanPreferences(accessToken) {
  const res = await fetch("/api/plan-preferences", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load preferences");
  return data.preferences || {};
}

export async function savePlanPreferences(accessToken, preferences) {
  const res = await fetch("/api/plan-preferences", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ preferences }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save preferences");
  return data.preferences || {};
}
