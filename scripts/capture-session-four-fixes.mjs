import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "session-four-fixes");

const MOCK_TRIP = {
  id: "mock-trip-dallas-la",
  origin: "Dallas, TX, USA",
  dest: "Los Angeles, CA, USA",
  date: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  answers: { vehicle: "RV", fuel_type: "Gasoline", travelers: "2" },
  stops: [
    { city: "El Paso, TX", name: "Franklin Mountains", lat: 31.79, lng: -106.42 },
  ],
  roadStops: [],
  routeInfo: {
    distance: "1,440 mi",
    duration: "20 hours",
    routePoints: [
      { lat: 32.78, lng: -96.8 },
      { lat: 34.05, lng: -118.24 },
    ],
  },
};

const MOCK_DRAFT = {
  origin: "Austin, TX",
  dest: "San Antonio, TX",
  answers: { vehicle: "Car" },
  questionHistory: [],
  convoComplete: false,
  savedAt: Date.now(),
};

const PROFILE = {
  display_name: "Cade Warmke",
  home_address: "Fort Worth, TX, USA",
  onboarding_complete: true,
  tier: "wanderer",
};
const CREDITS = { tier: "wanderer", unlimited: false, remaining: 2, limit: 3, used: 1 };

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function pickLabel(page, label) {
  const card = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: label }),
  }).first();
  if (await card.isVisible({ timeout: 2500 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const btn = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}

async function waitAsk(page, re, timeout = 25000) {
  await page.waitForFunction(
    (pattern) => new RegExp(pattern, "i").test(document.body?.innerText || ""),
    re.source,
    { timeout },
  ).catch(() => null);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // 1) Star slider via plan flow
  const flow = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await flow.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await flow.waitForSelector(".hero-plan-cta, .returning-user-action--plan", { timeout: 30000 });
  const cta = flow.locator(".hero-plan-cta").first();
  if (await cta.isVisible().catch(() => false)) await cta.click();
  else await flow.locator(".returning-user-action--plan").first().click();
  await flow.waitForSelector(".float-card--plan-flow", { timeout: 45000 });
  await waitAsk(flow, /Where are you headed/);
  await flow.locator("#plan-route-origin").fill("Dallas, TX");
  await closeAutocomplete(flow);
  await flow.locator("#plan-route-dest").fill("Austin, TX");
  await closeAutocomplete(flow);
  await flow.locator(".plan-flow-dock-continue, .btn-generate-inline").first().click();
  await waitAsk(flow, /How are you traveling/);
  await pickLabel(flow, "Car");
  await waitAsk(flow, /run on|fuel|Gasoline/i);
  await pickLabel(flow, "Gasoline");
  await waitAsk(flow, /towing|trailer/i);
  await pickLabel(flow, "No");
  await waitAsk(flow, /How many are joining/i);
  await pickLabel(flow, "Just me");
  await waitAsk(flow, /How often do you want to stop/);
  await pickLabel(flow, "Moderate");
  await waitAsk(flow, /budget level for hotels/i);
  await flow.waitForSelector(".plan-star-slider", { timeout: 15000 });
  await flow.locator(".plan-star-slider-track").click({ position: { x: 180, y: 24 } });
  await flow.waitForTimeout(600);
  await flow.screenshot({ path: path.join(OUT, "01-star-slider-desktop.png"), fullPage: false });
  await flow.setViewportSize({ width: 375, height: 812 });
  await flow.waitForTimeout(400);
  await flow.screenshot({ path: path.join(OUT, "01-star-slider-mobile.png"), fullPage: false });
  await flow.close();

  // 2) Centered loader — Suspense-like page with only the centered wordmark HTML inject via evaluate after goto root with delayed app
  const loader = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await loader.setContent(`
    <!doctype html>
    <html><head>
      <link rel="stylesheet" href="${BASE}/assets/index-BCR9Elj9.css" />
      <style>html,body{margin:0;height:100%;background:#0D0A1A}</style>
    </head><body>
      <div class="pulsing-wordmark pulsing-wordmark--lg pulsing-wordmark--centered" role="status" aria-busy="true" aria-label="Loading">
        <span class="pulsing-wordmark-inner" aria-hidden="true">
          <span class="pulsing-wordmark-trip">Trip</span>
          <span class="pulsing-wordmark-mappa">Mappa</span>
        </span>
      </div>
    </body></html>
  `);
  // Prefer live preview CSS from built app instead
  await loader.goto(`${BASE}/`);
  await loader.evaluate(() => {
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
    document.body.style.background = "#0D0A1A";
    const el = document.createElement("div");
    el.className = "pulsing-wordmark pulsing-wordmark--lg pulsing-wordmark--centered";
    el.setAttribute("role", "status");
    el.innerHTML = `<span class="pulsing-wordmark-inner" aria-hidden="true"><span class="pulsing-wordmark-trip">Trip</span><span class="pulsing-wordmark-mappa">Mappa</span></span>`;
    document.body.appendChild(el);
  });
  await loader.waitForTimeout(800);
  await loader.screenshot({ path: path.join(OUT, "02-centered-loader-desktop.png"), fullPage: false });
  await loader.setViewportSize({ width: 375, height: 812 });
  await loader.waitForTimeout(300);
  await loader.screenshot({ path: path.join(OUT, "02-centered-loader-mobile.png"), fullPage: false });
  await loader.close();

  // 3) Returning dashboard — draft + trip: only Continue planning (no Resume)
  const returning = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await returning.addInitScript(({ trip, draft, profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
    localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
    localStorage.setItem("tripmappa-plan-draft:v1", JSON.stringify(draft));
  }, { trip: MOCK_TRIP, draft: MOCK_DRAFT, profile: PROFILE, credits: CREDITS });
  await returning.goto(`${BASE}/?skyHour=12&skyTest=0`);
  await returning.waitForSelector(".returning-user-draft, .returning-user-recent", { timeout: 20000 });
  await returning.waitForTimeout(1200);
  await returning.screenshot({ path: path.join(OUT, "03-returning-draft-only-desktop.png"), fullPage: false });
  const resumeVisible = await returning.locator(".returning-user-resume-btn").isVisible().catch(() => false);
  const draftVisible = await returning.locator(".returning-user-draft").isVisible().catch(() => false);
  console.log(JSON.stringify({ draftVisible, resumeVisible }));

  // no-draft + trip only
  await returning.evaluate(() => localStorage.removeItem("tripmappa-plan-draft:v1"));
  await returning.reload();
  await returning.waitForSelector(".returning-user-recent", { timeout: 20000 });
  await returning.waitForTimeout(1000);
  await returning.screenshot({ path: path.join(OUT, "03b-returning-resume-only-desktop.png"), fullPage: false });
  const resumeOnly = await returning.locator(".returning-user-resume-btn").isVisible().catch(() => false);
  const draftGone = await returning.locator(".returning-user-draft").isVisible().catch(() => false);
  console.log(JSON.stringify({ draftGone, resumeOnly }));
  await returning.close();

  // 4) Profile menu redesign
  const menu = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await menu.addInitScript(({ profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
  }, { profile: PROFILE, credits: CREDITS });
  await menu.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await menu.waitForTimeout(2500);
  await menu.locator(".profile-card-trigger").click();
  await menu.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  await menu.waitForTimeout(400);
  await menu.screenshot({ path: path.join(OUT, "04-profile-menu-desktop.png"), fullPage: false });
  await menu.locator(".profile-card-support-toggle").click();
  await menu.waitForTimeout(300);
  await menu.screenshot({ path: path.join(OUT, "04b-profile-menu-support-open.png"), fullPage: false });
  await menu.setViewportSize({ width: 375, height: 812 });
  await menu.waitForTimeout(300);
  await menu.screenshot({ path: path.join(OUT, "04-profile-menu-mobile.png"), fullPage: false });

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
