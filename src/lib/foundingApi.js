/** Claim a Founding 1,000 slot after sign-up. */

export async function claimFoundingMembership(accessToken) {
  const res = await fetch("/api/founding-claim", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not claim founding membership");
  return data;
}
