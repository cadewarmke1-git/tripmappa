/** Client API for Stripe Checkout and Customer Portal (server-side only). */

export async function createCheckoutSession(accessToken, { userId, email }) {
  const res = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not start checkout");
  return data;
}

export async function createPortalSession(accessToken, customerId) {
  const res = await fetch("/api/stripe/create-portal-session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not open billing portal");
  return data;
}
