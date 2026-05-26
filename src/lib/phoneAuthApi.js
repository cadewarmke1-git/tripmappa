export async function sendSmsOtp(phone) {
  const res = await fetch("/api/send-sms-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not send code");
  return data;
}

export async function verifySmsOtp(phone, code) {
  const res = await fetch("/api/verify-sms-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not verify code");
  return data;
}
