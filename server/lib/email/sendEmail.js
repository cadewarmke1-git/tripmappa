/**
 * Transactional email via Resend (same pattern as Twilio for SMS).
 * Requires RESEND_API_KEY and TRIPMAPPA_EMAIL_FROM in environment.
 */

export async function sendTripmappaEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TRIPMAPPA_EMAIL_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("tripmappa email: RESEND_API_KEY or TRIPMAPPA_EMAIL_FROM not set");
    return { sent: false, skipped: true, reason: "missing_resend_env" };
  }
  if (!to) return { sent: false, skipped: true, reason: "missing_recipient" };

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

  const bodyText = await res.text().catch(() => "");
  let bodyJson = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }

  if (!res.ok) {
    console.error("tripmappa email send failed:", res.status, bodyText);
    return {
      sent: false,
      error: "send_failed",
      status: res.status,
      resend: bodyJson,
      raw: bodyText?.slice?.(0, 500) || bodyText || null,
    };
  }

  return {
    sent: true,
    status: res.status,
    id: bodyJson?.id || null,
    resend: bodyJson,
  };
}

/** Fetch a single email's Resend record (includes last_event delivery status). */
export async function getResendEmail(emailId) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !emailId) return { ok: false, skipped: true };
  const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const bodyText = await res.text().catch(() => "");
  let bodyJson = null;
  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    bodyJson = null;
  }
  if (!res.ok) {
    return { ok: false, status: res.status, resend: bodyJson, raw: bodyText?.slice?.(0, 500) || null };
  }
  return { ok: true, status: res.status, resend: bodyJson, last_event: bodyJson?.last_event || null };
}

export async function getUserEmail(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw error;
  return data?.user?.email || null;
}
