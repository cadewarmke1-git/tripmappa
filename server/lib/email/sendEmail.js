/**
 * Transactional email via Resend (same pattern as Twilio for SMS).
 * Requires RESEND_API_KEY and TRIPMAPPA_EMAIL_FROM in environment.
 */

export async function sendTripmappaEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TRIPMAPPA_EMAIL_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("tripmappa email: RESEND_API_KEY or TRIPMAPPA_EMAIL_FROM not set");
    return { sent: false, skipped: true };
  }
  if (!to) return { sent: false, skipped: true };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text: text || undefined,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("tripmappa email send failed:", res.status, errBody);
    return { sent: false, error: "send_failed" };
  }

  return { sent: true };
}

export async function getUserEmail(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data?.user?.email || null;
}
