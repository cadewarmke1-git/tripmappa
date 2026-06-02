/** Clear trial-ended upgrade prompt flag. */

export async function dismissTrialEndedPrompt(accessToken) {
  const res = await fetch("/api/trial/dismiss-prompt", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not dismiss trial prompt");
  return data;
}
