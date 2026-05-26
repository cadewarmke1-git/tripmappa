/** Client API for signed-in user trip generation credits. */

export async function fetchTripCredits(accessToken) {
  const res = await fetch("/api/trip-credits", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load credits");
  return data;
}
