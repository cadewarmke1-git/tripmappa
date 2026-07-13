import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "four-fixes-screenshots");

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function pickLabel(page, label) {
  const card = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: label }),
  }).first();
  if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const btn = page.getByRole("button", { name: new RegExp(label, "i") }).first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}

async function waitAsk(page, re, timeout = 20000) {
  await page.waitForFunction(
    (pattern) => {
      const text = document.body?.innerText || "";
      return new RegExp(pattern, "i").test(text);
    },
    re.source,
    { timeout },
  ).catch(() => null);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // --- Signed-out hero + profile ---
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForSelector(".hero-title-line", { timeout: 20000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "01-hero-clean.png"), fullPage: false });

  await page.locator(".profile-card-trigger").click();
  await page.waitForSelector(".profile-card-dropdown.is-open", { timeout: 5000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, "02-profile-signed-out.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // --- Plan flow through to new questions ---
  await page.locator(".hero-plan-cta").click();
  await page.waitForSelector(".float-card--plan-flow", { timeout: 45000 });
  await waitAsk(page, /Where are you headed/);

  await page.locator("#plan-route-origin").fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator("#plan-route-dest").fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".plan-flow-dock-continue, .btn-generate-inline").first().click();
  await waitAsk(page, /How are you traveling/);

  await pickLabel(page, "Car");
  await waitAsk(page, /run on|fuel|Gasoline/i);
  await pickLabel(page, "Gasoline");
  await waitAsk(page, /towing|trailer/i);
  await pickLabel(page, "No");
  await waitAsk(page, /How many are joining/i);
  await pickLabel(page, "Just me");
  await waitAsk(page, /How often do you want to stop/);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "03-stop-frequency.png"), fullPage: false });

  await pickLabel(page, "Moderate");
  await waitAsk(page, /budget level for hotels/i);
  await page.waitForSelector(".plan-star-slider", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "03b-luxury-level.png"), fullPage: false });

  // --- Navigate via signed-in dashboard CTA when available; otherwise logo home ---
  await page.locator(".nav-logo-home, .brand-wordmark, a.nav-logo-home").first().click().catch(() => {});
  await page.waitForTimeout(800);
  const openNavigate = page.locator(".returning-user-action--navigate").first();
  if (await openNavigate.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openNavigate.click();
  } else {
    // Signed-out: skip navigate panel capture
    console.log("skip navigate — no returning-user navigate CTA");
  }
  await page.waitForSelector(".navigate-route-panel", { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1500);
  if (await page.locator("#navigate-origin").isVisible().catch(() => false)) {
    await page.locator("#navigate-origin").fill("Dallas, TX");
    await page.locator("#navigate-dest").fill("Austin, TX");
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "04-navigate-route.png"), fullPage: false });

    await page.locator("button.navigate-route-go, button:has-text('Get route')").click().catch(() => {});
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(OUT, "04b-navigate-routed.png"), fullPage: false });
  }
  await page.close();

  // --- Signed-in profile ---
  const signedIn = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await signedIn.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = {
      display_name: "Cade Warmke",
      home_address: "Fort Worth, TX, USA",
      onboarding_complete: true,
      tier: "wanderer",
    };
    window.__TRIPMAPPA_E2E_CREDITS__ = { tier: "wanderer", unlimited: false, remaining: 3, limit: 3 };
  });
  await signedIn.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await signedIn.waitForTimeout(3000);
  await signedIn.locator(".profile-card-trigger").click();
  await signedIn.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  await signedIn.waitForTimeout(450);
  await signedIn.screenshot({ path: path.join(OUT, "05-profile-signed-in.png"), fullPage: false });

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
