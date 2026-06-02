/** TripMappa transactional email HTML — Fraunces headings, gold accent. */

const SITE_URL = process.env.TRIPMAPPA_SITE_URL || "https://tripmappa.com";

function layout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0D0A1A;font-family:Inter,Arial,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0D0A1A;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#1A1035;border:1px solid rgba(255,210,140,0.15);border-radius:16px;">
          <tr>
            <td style="padding:28px 24px 8px;">
              <p style="margin:0;font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:700;color:#FFD28C;line-height:1.25;">${title}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 28px;font-size:15px;line-height:1.6;color:#A89BCF;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#FF8C42;color:#1A0D00;font-weight:700;text-decoration:none;font-size:14px;">Open TripMappa</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function trialEndingTomorrowEmail({ trialEndDate }) {
  const title = "Your Trailblazer trial ends tomorrow";
  const bodyHtml = `
    <p style="margin:0 0 16px;">Your 7-day Trailblazer trial ends on <strong style="color:#FFD28C;">${trialEndDate}</strong>.</p>
    <p style="margin:0 0 16px;">Upgrade to keep unlimited trip generations, grocery delivery, and priority planning.</p>
    <p style="margin:0;">If you do not upgrade, your account will return to the free Wanderer plan when the trial ends.</p>
  `;
  return {
    subject: "Your TripMappa Trailblazer trial ends tomorrow",
    html: layout({ title, bodyHtml }),
    text: `Your Trailblazer trial ends tomorrow (${trialEndDate}). Upgrade at ${SITE_URL} to keep premium features.`,
  };
}

export function welcomePlanEmail({ planName, benefits, billingDate }) {
  const title = `Welcome to TripMappa ${planName}`;
  const benefitList = benefits.map(b => `<li style="margin-bottom:6px;">${b}</li>`).join("");
  const bodyHtml = `
    <p style="margin:0 0 16px;">Thank you for subscribing to <strong style="color:#FFD28C;">${planName}</strong>.</p>
    <p style="margin:0 0 8px;font-weight:600;color:#FFD28C;">You now have access to:</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${benefitList}</ul>
    <p style="margin:0;">Your next billing date is <strong style="color:#FFD28C;">${billingDate}</strong>.</p>
  `;
  return {
    subject: `Welcome to TripMappa ${planName}`,
    html: layout({ title, bodyHtml }),
    text: `Welcome to ${planName}. Next billing: ${billingDate}. Visit ${SITE_URL}`,
  };
}
