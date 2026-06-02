/** Account setup after sign-in: referral, founding slot, Trailblazer trial. */

export async function runAccountOnboarding(accessToken, { refCode } = {}) {
  const res = await fetch("/api/account-onboarding", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refCode: refCode || undefined }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not complete account setup");
  return data;
}
