/** Public Founder 1,000 remaining slots counter. */

export async function fetchFoundingSlotsRemaining() {
  const res = await fetch("/api/founding-slots");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load founding slots");
  return data;
}
