/** Client API for /api/plan-preferences */

export async function fetchPlanPreferences(accessToken) {
  const { preferences } = await fetchPlanPreferencesFull(accessToken);
  return preferences;
}

export async function fetchPlanPreferencesFull(accessToken) {
  const res = await fetch("/api/plan-preferences", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load preferences");
  return {
    preferences: data.preferences || {},
    meta: data.meta || {},
  };
}

export async function savePlanPreferences(accessToken, preferences) {
  const saved = await savePlanPreferencesFull(accessToken, preferences);
  return saved;
}

export async function savePlanPreferencesFull(accessToken, preferences, meta = {}) {
  const res = await fetch("/api/plan-preferences", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ preferences, meta }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save preferences");
  return {
    preferences: data.preferences || {},
    meta: data.meta || {},
  };
}
