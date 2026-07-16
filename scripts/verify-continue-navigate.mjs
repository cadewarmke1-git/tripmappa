import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "continue-navigate-verify");

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".plan-flow-question-title, .hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(250);
}

async function installE2eAuth(page) {
  await page.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
  });
  await page.route("**/api/trip-credits", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier: "wanderer",
        unlimited: false,
        remaining: 3,
        limit: 3,
        used: 0,
        groceryDelivery: false,
      }),
    });
  });
}

async function capture(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function verifyPlanContinue(page, label) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`);
  await page.waitForTimeout(1500);

  const cta = page.locator(".hero-plan-cta, .returning-user-action--plan").first();
  await cta.waitFor({ state: "visible", timeout: 90_000 });
  await cta.click();

  await page.locator(".float-card--plan-flow").waitFor({ timeout: 45_000 });
  await page.locator(".plan-flow-question-title").filter({ hasText: /Where are you headed/i }).waitFor({ timeout: 20_000 });

  await page.locator("#plan-route-origin").fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator("#plan-route-dest").fill("Austin, TX");
  await closeAutocomplete(page);
  await page.waitForTimeout(400);

  const before = await capture(page, `01-route-setup-filled-${label}.png`);

  const continueBtn = page.locator(".plan-flow-dock-continue").first();
  await continueBtn.waitFor({ state: "visible", timeout: 10_000 });
  await continueBtn.click();

  await page.locator(".plan-flow-question-title").filter({ hasText: /How are you traveling/i }).waitFor({ timeout: 25_000 });
  const after = await capture(page, `02-after-continue-vehicle-${label}.png`);

  // Step through 2 more picks so we have 3 question steps of evidence
  const car = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: "Car", exact: true }),
  }).first();
  await car.click();
  await page.waitForTimeout(500);
  await page.locator(".plan-flow-question-title").first().waitFor({ timeout: 15_000 });
  const step3 = await capture(page, `03-step-after-car-${label}.png`);

  return { before, after, step3, advanced: true };
}

async function verifyNavigateToOnly(page, label) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`);
  await page.waitForTimeout(1200);

  const navCta = page.locator(".hero-navigate-cta, .returning-user-action--navigate, button:has-text('Navigate')").first();
  if (await navCta.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await navCta.click();
  } else {
    // Fallback: nav mode via hash/query if present
    await page.evaluate(() => {
      if (typeof window.__TRIPMAPPA_START_NAVIGATE__ === "function") {
        window.__TRIPMAPPA_START_NAVIGATE__();
      }
    });
  }

  await page.locator(".navigate-route-panel").waitFor({ timeout: 20_000 }).catch(() => null);
  const panelVisible = await page.locator(".navigate-route-panel").isVisible().catch(() => false);
  if (!panelVisible) {
    // Try dashboard navigate for returning-user styled page
    const dashNav = page.getByRole("button", { name: /Navigate/i }).first();
    if (await dashNav.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dashNav.click();
      await page.locator(".navigate-route-panel").waitFor({ timeout: 15_000 });
    }
  }

  const shot = await capture(page, `04-navigate-panel-${label}.png`);
  const fromCount = await page.locator("#navigate-origin, label:has-text('From')").count();
  const whereTo = await page.locator("#navigate-dest, .navigate-where-search").count();
  return { shot, fromCount, whereTo };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { ok: true, checks: [] };

  for (const { label, width, height } of [
    { label: "desktop", width: 1280, height: 800 },
    { label: "mobile", width: 375, height: 812 },
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await installE2eAuth(page);

    try {
      const plan = await verifyPlanContinue(page, label);
      report.checks.push({ label, type: "plan-continue", advanced: plan.advanced, files: [plan.before, plan.after, plan.step3] });
    } catch (err) {
      report.ok = false;
      await capture(page, `ERR-plan-${label}.png`).catch(() => {});
      report.checks.push({ label, type: "plan-continue", error: String(err) });
    }

    try {
      const nav = await verifyNavigateToOnly(page, label);
      const navOk = nav.fromCount === 0 && nav.whereTo > 0;
      if (!navOk) report.ok = false;
      report.checks.push({ label, type: "navigate-to-only", fromCount: nav.fromCount, whereTo: nav.whereTo, ok: navOk, file: nav.shot });
    } catch (err) {
      report.ok = false;
      await capture(page, `ERR-nav-${label}.png`).catch(() => {});
      report.checks.push({ label, type: "navigate-to-only", error: String(err) });
    }

    await page.close();
  }

  await browser.close();
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
