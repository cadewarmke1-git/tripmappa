/**
 * Draft-first flow walkthrough — measures screens/time and captures screenshots.
 * Run: node scripts/draft-first-walkthrough.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.VERIFY_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const OUT = path.resolve("tmp/draft-first-walkthrough");
fs.mkdirSync(OUT, { recursive: true });

async function fillAndSelectPlace(page, inputSelector, query) {
  const input = page.locator(inputSelector);
  await input.click({ force: true });
  await input.fill("");
  await input.type(query, { delay: 40 });
  await page.waitForTimeout(700);
  const suggestion = page.locator(".pac-item").first();
  if (await suggestion.count()) {
    await suggestion.click({ force: true });
    await page.waitForTimeout(300);
  } else {
    await input.fill(query);
  }
  await page.keyboard.press("Escape").catch(() => null);
}

async function openRouteSetup(page) {
  await page.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = { onboarding_complete: true, tier: "trailblazer" };
    window.__TRIPMAPPA_E2E_CREDITS__ = { tier: "trailblazer", unlimited: true, remaining: 100, limit: 100 };
  });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator(".hero-plan-cta, .hero-go-btn, .returning-user-action").first().click();
  await page.waitForTimeout(800);
  for (const label of [/plan a (new )?trip/i, /new trip/i, /start planning/i]) {
    const btn = page.locator("button, a").filter({ hasText: label }).first();
    if (await btn.isVisible().catch(() => false) && !(await page.locator(".plan-route-setup").count())) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(500);
    }
  }
  await page.waitForSelector(".plan-route-setup-defaults, .plan-route-setup", { timeout: 30000, state: "attached" });
  // Expand the plan float card if it collapsed after launch.
  const expand = page.locator(".float-card.collapsed .float-card-collapse, .float-card.collapsed [aria-label*='Expand'], .float-card.collapsed .plan-flow-header-bar button").first();
  if (await page.locator(".float-card.collapsed").count()) {
    await page.locator(".float-card.collapsed").locator("button").last().click({ force: true }).catch(() => null);
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => Boolean(window.google?.maps?.places), { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = { screens: [], timings: {}, notes: [] };

  async function shot(page, name, note) {
    const file = path.join(OUT, `${String(report.screens.length + 1).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    report.screens.push({ name, file, note });
    console.log(`shot: ${name} — ${note}`);
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const t0 = Date.now();
  await openRouteSetup(page);

  const defaultsText = await page.locator(".plan-route-setup-defaults-line").textContent().catch(() => "");
  report.notes.push(`defaults line: ${defaultsText?.trim()}`);
  await shot(page, "route-setup-defaults", `Route setup with defaults: ${defaultsText?.trim()}`);

  const continueBtn = page.locator(".plan-flow-dock-continue, .plan-flow-action-dock .btn-generate").first();
  await fillAndSelectPlace(page, "#plan-route-origin", "Dallas, TX");
  await fillAndSelectPlace(page, "#plan-route-dest", "Austin, TX");

  const box = await continueBtn.boundingBox();
  if (box) {
    const top = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? { tag: el.tagName, className: String(el.className).slice(0, 80), text: (el.textContent || "").slice(0, 40) } : null;
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    report.notes.push(`continue hit-test @1280: ${JSON.stringify(top)}`);
  }

  const tContinue = Date.now();
  await continueBtn.click({ force: true });
  await page.waitForSelector(".trip-draft-panel, .plan-route-setup-error, .error-boundary-fallback", { timeout: 25000 }).catch(() => null);
  if (await page.locator(".float-card.collapsed").count()) {
    await page.locator(".float-card.collapsed button").last().click({ force: true }).catch(() => null);
    await page.waitForTimeout(400);
  }
  const draftMs = Date.now() - tContinue;
  report.timings.routeSetupToDraftMs = draftMs;

  const errors = await page.locator(".plan-route-setup-error").allTextContents().catch(() => []);
  if (errors.length) report.notes.push(`route errors: ${errors.join(" | ")}`);
  const boundary = await page.locator(".error-boundary-fallback, .error-boundary-msg").allTextContents().catch(() => []);
  if (boundary.length) report.notes.push(`error boundary: ${boundary.join(" | ")}`);

  const hasDraft = await page.locator(".trip-draft-panel").count();
  report.notes.push(`draft panel present: ${hasDraft > 0}; time=${draftMs}ms`);
  await shot(page, "draft-screen", hasDraft ? "Draft with route stats and tune panel" : "Draft missing after Continue");

  if (hasDraft) {
    await page.locator(".trip-draft-tune-toggle").first().click({ force: true });
    await page.waitForTimeout(400);
    await shot(page, "tune-section-expanded", "First tune section expanded");
  }

  // Mobile route setup
  await page.setViewportSize({ width: 375, height: 812 });
  await openRouteSetup(page);
  await shot(page, "route-setup-mobile", "Mobile route setup with defaults");

  // EV interrupt: use a fresh page to avoid leftover state from the mobile pass.
  const evPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await openRouteSetup(evPage);
  await fillAndSelectPlace(evPage, "#plan-route-origin", "Dallas, TX");
  await fillAndSelectPlace(evPage, "#plan-route-dest", "Austin, TX");
  await evPage.locator(".plan-route-setup-customize").click({ force: true });
  await evPage.locator(".plan-flow-dock-continue, .plan-flow-action-dock .btn-generate").first().click({ force: true });
  await evPage.waitForSelector(".trip-draft-panel", { timeout: 25000 }).catch(() => null);
  await evPage.locator(".trip-draft-generate").click({ force: true }).catch(() => null);
  await evPage.waitForTimeout(800);
  const electric = evPage.getByRole("button", { name: /^Electric$/ }).first();
  if (await electric.count()) {
    await electric.click({ force: true });
    await evPage.waitForSelector(".trip-draft-panel", { timeout: 15000 }).catch(() => null);
    await evPage.waitForTimeout(500);
  }
  await evPage.locator(".trip-draft-generate").click({ force: true }).catch(() => null);
  await evPage.waitForTimeout(1000);
  const chargingTitle = evPage
    .locator(".plan-flow-question-title, .trip-draft-title")
    .filter({ hasText: /charging network/i })
    .first();
  const hasCharging = await chargingTitle.count();
  report.notes.push(`EV charging interrupt visible: ${hasCharging > 0}`);
  await shot(evPage, "ev-interrupt", hasCharging ? "EV charging network interrupt" : "EV interrupt not reached");
  await evPage.close();

  report.timings.totalMs = Date.now() - t0;
  report.screenCount = report.screens.length;
  report.oldTypicalScreens = "10-14";
  report.newPrimaryScreens = "2 (route setup → draft) before Generate";
  report.deliversValueInTwoInteractions = hasDraft > 0;

  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(hasDraft > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
