/** TripMappa transactional email HTML — locked night / gold / orange palette. */

const SITE_URL = process.env.TRIPMAPPA_SITE_URL || "https://tripmappa.com";

/** Locked design tokens (no purple — Gmail mobile was picking up #1A1035 / #A89BCF). */
const EMAIL = {
  night: "#0D0A1A",
  card: "#0D0A1A",
  gold: "#FFD28C",
  orange: "#FF8C42",
  cream: "#FDF3E0",
  border: "#5C4A2E",
  btnText: "#1A0D00",
};

function layout({ title, bodyHtml }) {
  const { night, card, gold, orange, cream, border, btnText } = EMAIL;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark only" />
  <meta name="supported-color-schemes" content="dark only" />
  <title>${title}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body bgcolor="${night}" style="margin:0;padding:0;background-color:${night};font-family:Georgia,Times,serif;color:${cream};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${night}" style="background-color:${night};">
    <tr>
      <td align="center" bgcolor="${night}" style="padding:32px 16px;background-color:${night};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${card}" style="max-width:520px;background-color:${card};border:1px solid ${border};border-radius:16px;">
          <tr>
            <td bgcolor="${card}" style="padding:28px 24px 8px;background-color:${card};">
              <p style="margin:0;font-family:Georgia,Times,serif;font-size:26px;font-weight:700;color:${gold};line-height:1.25;">${title}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="${card}" style="padding:8px 24px 28px;font-size:15px;line-height:1.6;color:${cream};background-color:${card};font-family:Arial,Helvetica,sans-serif;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td bgcolor="${card}" style="padding:0 24px 24px;background-color:${card};">
              <a href="${SITE_URL}" style="display:inline-block;padding:12px 20px;border-radius:10px;background-color:${orange};color:${btnText};font-weight:700;text-decoration:none;font-size:14px;font-family:Arial,Helvetica,sans-serif;">Open TripMappa</a>
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Founder-slot claim welcome (not the paid-upgrade template).
 * firstName: optional greeting name; omit / empty → heading is "Welcome" (no placeholder).
 */
export function welcomeFounderEmail({ firstName, expiresLabel } = {}) {
  const name = String(firstName || "").trim();
  const title = name ? `Welcome, ${escapeHtml(name)}` : "Welcome";
  const subject = name ? `Welcome to TripMappa, ${name}` : "Welcome to TripMappa";
  const accessHtml = expiresLabel
    ? `effective through <strong style="color:${EMAIL.gold};">${escapeHtml(expiresLabel)}</strong>`
    : "effective for three months from today";
  const accessText = expiresLabel
    ? `effective through ${expiresLabel}`
    : "effective for three months from today";
  const bodyHtml = `
    <p style="margin:0 0 16px;color:${EMAIL.cream};">Thank you for joining TripMappa as one of our first 250 Founding Members. I wanted to personally welcome you.</p>
    <p style="margin:0 0 16px;color:${EMAIL.cream};">As a Founding Member, you will receive three months of Voyager access, complimentary, ${accessHtml}.</p>
    <p style="margin:0 0 16px;color:${EMAIL.cream};">Your Founder status is permanent and will remain on your profile going forward.</p>
    <p style="margin:0 0 16px;color:${EMAIL.cream};">If you ever notice anything off with a suggested stop, please use the &quot;Report this stop&quot; option.</p>
    <p style="margin:0 0 16px;color:${EMAIL.cream};">If you have any other questions or concerns, feel free to reach out anytime at <a href="mailto:support@tripmappa.com" style="color:${EMAIL.gold};text-decoration:underline;">support@tripmappa.com</a>.</p>
    <p style="margin:0 0 16px;color:${EMAIL.cream};">Thank you again for your early support.</p>
    <p style="margin:0;color:${EMAIL.cream};">Cade<br />Founder, TripMappa</p>
  `;
  return {
    subject,
    html: layout({ title, bodyHtml }),
    text: [
      title,
      "",
      "Thank you for joining TripMappa as one of our first 250 Founding Members. I wanted to personally welcome you.",
      "",
      `As a Founding Member, you will receive three months of Voyager access, complimentary, ${accessText}.`,
      "",
      "Your Founder status is permanent and will remain on your profile going forward.",
      "",
      'If you ever notice anything off with a suggested stop, please use the "Report this stop" option.',
      "",
      "If you have any other questions or concerns, feel free to reach out anytime at support@tripmappa.com.",
      "",
      "Thank you again for your early support.",
      "",
      "Cade",
      "Founder, TripMappa",
      "",
      `Open TripMappa: ${SITE_URL}`,
    ].join("\n"),
  };
}
