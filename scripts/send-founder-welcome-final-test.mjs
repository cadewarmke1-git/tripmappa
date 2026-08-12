/**
 * Send one Founder welcome using the local (updated) template via Resend.
 *
 * Prefers local RESEND_API_KEY + TRIPMAPPA_EMAIL_FROM.
 * If missing, pulls production env via CURSVER_TOK (Sensitive values may be empty).
 *
 * Usage:
 *   node --env-file=.env.local scripts/send-founder-welcome-final-test.mjs
 *   FOUNDER_WELCOME_TEST_FIRST_NAME=Cade FOUNDER_WELCOME_TEST_EMAIL=you@example.com node --env-file=.env.local ...
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { welcomeFounderEmail } from "../server/lib/email/templates.js";
import { formatTripmappaFromAddress } from "../server/lib/email/sendEmail.js";
import { threeMonthsFromNow } from "../server/lib/foundingMembers.js";
import { formatEmailDate } from "../server/lib/trials.js";

function parseEnv(text) {
  const out = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = val;
  }
  return out;
}

function loadResendEnv() {
  const fromProcess = {
    RESEND_API_KEY: process.env.RESEND_API_KEY || "",
    TRIPMAPPA_EMAIL_FROM: process.env.TRIPMAPPA_EMAIL_FROM || process.env.EMAIL_FROM || "",
  };
  if (fromProcess.RESEND_API_KEY) return { ...fromProcess, source: "process" };

  const token = process.env.CURSVER_TOK;
  if (!token) return { ...fromProcess, source: "missing" };

  const out = path.join(process.cwd(), ".env.vercel.tmp");
  const pull = spawnSync(
    "npx",
    ["vercel", "env", "pull", out, "--environment=production", "--yes", "--token", token],
    { encoding: "utf8", shell: true },
  );
  if (pull.status !== 0 || !fs.existsSync(out)) {
    return { ...fromProcess, source: "pull_failed" };
  }
  const pulled = parseEnv(fs.readFileSync(out, "utf8"));
  fs.rmSync(out, { force: true });
  return {
    RESEND_API_KEY: pulled.RESEND_API_KEY || "",
    TRIPMAPPA_EMAIL_FROM: pulled.TRIPMAPPA_EMAIL_FROM || pulled.EMAIL_FROM || "",
    source: "vercel_pull",
  };
}

async function main() {
  const resendEnv = loadResendEnv();
  const apiKey = resendEnv.RESEND_API_KEY;
  const from = formatTripmappaFromAddress(
    resendEnv.TRIPMAPPA_EMAIL_FROM || "hello@tripmappa.com",
  );
  if (!apiKey) {
    throw new Error(
      `Missing RESEND_API_KEY (source=${resendEnv.source}). Add it to .env.local for a local template test send.`,
    );
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");

  const forcedName = String(process.env.FOUNDER_WELCOME_TEST_FIRST_NAME || "").trim();
  const testEmail = (
    process.env.FOUNDER_WELCOME_TEST_EMAIL || "cadewarmke1@gmail.com"
  )
    .trim()
    .toLowerCase();

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const user = listed?.users?.find((u) => String(u.email || "").toLowerCase() === testEmail);
  if (!user) throw new Error(`No auth user for ${testEmail}`);

  let firstName = forcedName;
  let nameSource = forcedName ? "env_override" : null;
  if (!firstName) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.display_name) {
      firstName = String(profile.display_name).trim().split(/\s+/)[0] || "";
      nameSource = "profile.display_name";
    }
  }
  if (!firstName) {
    const meta = user.user_metadata || {};
    const raw = meta.full_name || meta.name || meta.display_name || "";
    firstName = String(raw).trim().split(/\s+/)[0] || "";
    if (firstName) nameSource = "auth.user_metadata";
  }
  if (!firstName) {
    // Force a real test name so we can confirm personalization rendering end-to-end.
    firstName = "Cade";
    nameSource = "test_default";
  }

  const expiresLabel = formatEmailDate(threeMonthsFromNow());
  const { subject, html, text } = welcomeFounderEmail({ firstName, expiresLabel });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [testEmail], subject, html, text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend failed ${res.status}: ${JSON.stringify(body)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        to: testEmail,
        from,
        subject,
        id: body.id || null,
        firstName,
        nameSource,
        personalized: true,
        heading: `Welcome, ${firstName}`,
        hasSupport: html.includes("support@tripmappa.com"),
        hasPlaceholder: html.includes("PLACEHOLDER"),
        hasOpenButton: html.includes("Open TripMappa"),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
