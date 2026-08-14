/**
 * Live Founder welcome email verification against production.
 *
 * Creates a temporary auth user (Gmail plus-address → founder inbox), claims a
 * Founder slot via /api/account-onboarding (triggers send once), re-calls to
 * confirm already-claimed, then deletes the user + founding_members row.
 *
 *   node --env-file=.env.local scripts/test-founder-welcome-email.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { threeMonthsFromNow } from "../server/lib/foundingMembers.js";
import { sendFounderWelcomeEmail } from "../server/lib/email/founderWelcome.js";

const SITE = process.env.TRIPMAPPA_SITE_URL || "https://tripmappa.com";
const stamp = Date.now();
const TEST_EMAIL = (
  process.env.FOUNDER_WELCOME_TEST_EMAIL
  || `cadewarmke+founderwelcome${stamp}@gmail.com`
).trim().toLowerCase();
const TEST_PASSWORD = `FwTest_${stamp}_!`;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("SUPABASE_URL and anon key required");

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let userId = null;
  let cleaned = false;

  async function cleanup() {
    if (cleaned || !userId) return;
    cleaned = true;
    await admin.from("founding_members").delete().eq("user_id", userId);
    await admin.from("user_profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    console.log("cleanup: deleted temp user + founding row", userId);
  }

  try {
    // Path A: local Resend available — send once without claiming a public slot.
    if (process.env.RESEND_API_KEY && (process.env.TRIPMAPPA_EMAIL_FROM || process.env.EMAIL_FROM)) {
      const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw listErr;
      const existing = listed?.users?.find((u) => String(u.email || "").toLowerCase() === "cadewarmke1@gmail.com");
      if (!existing) throw new Error("cadewarmke1@gmail.com auth user not found for local Resend path");
      console.log("local Resend path: sending once to cadewarmke1@gmail.com");
      const first = await sendFounderWelcomeEmail(admin, existing.id, {
        founderExpiresAt: threeMonthsFromNow(),
      });
      console.log("first_send", first);
      if (!first?.sent) throw new Error(`Expected sent:true, got ${JSON.stringify(first)}`);

      const { tryClaimFoundingSlot } = await import("../server/lib/foundingMembers.js");
      const again = await tryClaimFoundingSlot(admin, existing.id);
      console.log("already_claim", again);
      if (!(again?.claimed && again?.already)) {
        throw new Error(`Expected already claim, got ${JSON.stringify(again)}`);
      }
      console.log("OK: local send once + already-claim does not re-claim.");
      return;
    }

    // Path B: production claim path (Vercel has Resend).
    console.log(`production claim path: creating ${TEST_EMAIL}`);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Cade Tester" },
    });
    if (createErr) throw createErr;
    userId = created.user.id;

    const { data: signed, error: signErr } = await anon.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    if (signErr) throw signErr;
    const token = signed.session.access_token;

    const firstRes = await fetch(`${SITE}/api/account-onboarding`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const firstBody = await firstRes.json();
    console.log("first_onboarding", firstRes.status, JSON.stringify(firstBody, null, 2));
    if (!firstRes.ok) throw new Error(`onboarding failed: ${JSON.stringify(firstBody)}`);
    if (!(firstBody?.founder?.claimed && !firstBody?.founder?.already)) {
      throw new Error(`Expected fresh Founder claim, got ${JSON.stringify(firstBody.founder)}`);
    }
    console.log("welcomeEmail", JSON.stringify(firstBody?.founder?.welcomeEmail ?? null, null, 2));
    if (!firstBody?.founder?.welcomeEmail) {
      throw new Error("Expected founder.welcomeEmail in claim response (deploy may be stale)");
    }
    const welcome = firstBody.founder.welcomeEmail;
    const fromUsed = welcome.from;
    if (!fromUsed || !/^TripMappa\s+</i.test(fromUsed)) {
      throw new Error(`Expected From display name TripMappa, got ${JSON.stringify(fromUsed)}`);
    }
    if (welcome.subject !== "Welcome to TripMappa, Founding Member") {
      throw new Error(`Unexpected subject (deploy may be stale): ${JSON.stringify(welcome.subject)}`);
    }
    console.log(
      JSON.stringify(
        {
          personalization: welcome.personalized ? "used_firstName" : "fell_back_to_Welcome",
          firstName: welcome.firstName || null,
          subject: welcome.subject,
          from: fromUsed,
          sent: welcome.sent,
          id: welcome.id || null,
        },
        null,
        2,
      ),
    );

    const secondRes = await fetch(`${SITE}/api/account-onboarding`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const secondBody = await secondRes.json();
    console.log("second_onboarding", secondRes.status, secondBody);
    if (!(secondBody?.founder?.claimed && secondBody?.founder?.already)) {
      throw new Error(`Expected already Founder claim, got ${JSON.stringify(secondBody.founder)}`);
    }

    console.log(
      "OK: production claim sent Founder welcome once; second call was already.",
    );
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
