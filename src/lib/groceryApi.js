/** Client API for grocery order submission. */

export async function submitGroceryOrder({
  items,
  address,
  scheduledTime,
  tripId,
  fulfillmentMode = "delivery",
  hotelName = null,
  accessToken = null,
}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch("/api/grocery/order", {
    method: "POST",
    headers,
    body: JSON.stringify({
      items,
      address,
      scheduledTime,
      tripId,
      fulfillmentMode,
      hotelName,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not place grocery order");
  return data;
}
