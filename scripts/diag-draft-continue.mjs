/**
 * Diagnose what happens after route-setup Continue in draft-first flow.
 * Run: node scripts/diag-draft-continue.mjs
 */
import { chromium } from "@playwright/test";

const BASE = (process.env.VERIFY_BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");

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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = { onboarding_complete: true, tier: "trailblazer" };
    window.__TRIPMAPPA_E2E_CREDITS__ = { tier: "trailblazer", unlimited: true, remaining: 100, limit: 100 };
  });

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
  await page.waitForSelector(".plan-route-setup, #plan-route-origin", { timeout: 30000, state: "attached" });
  await page.waitForFunction(() => Boolean(window.google?.maps?.places), { timeout: 60000 }).catch(() => null);

  // Expand if needed
  const expandBtn = page.locator('[aria-label="Show panel"], [aria-label="Expand plan panel"]').first();
  if (await expandBtn.count()) await expandBtn.click({ force: true }).catch(() => null);

  const before = await page.evaluate(() => {
    const card = document.querySelector(".float-card");
    const body = document.querySelector(".float-card-body");
    return {
      cardClass: card?.className,
      bodyH: body?.getBoundingClientRect?.()?.height,
      routeSetup: !!document.querySelector(".plan-route-setup"),
      defaults: document.querySelector(".plan-route-setup-defaults-line")?.textContent?.trim(),
      draft: !!document.querySelector(".trip-draft-panel"),
      ask: document.querySelector(".plan-flow-question-title")?.textContent?.trim(),
      boundary: document.querySelector(".error-boundary-msg, .error-boundary-title")?.textContent?.trim(),
    };
  });
  console.log("BEFORE", JSON.stringify(before, null, 2));

  await fillAndSelectPlace(page, "#plan-route-origin", "Dallas, TX");
  await fillAndSelectPlace(page, "#plan-route-dest", "Austin, TX");

  const continueBtn = page.locator(".plan-flow-dock-continue, .plan-flow-action-dock .btn-generate").first();
  console.log("continue visible", await continueBtn.isVisible().catch(() => false));
  console.log("continue count", await continueBtn.count());

  // Prefer real click; fall back to evaluating the dock handler via button click force
  await continueBtn.click({ force: true });
  await page.waitForTimeout(3000);

  const after = await page.evaluate(() => {
    const card = document.querySelector(".float-card");
    const body = document.querySelector(".float-card-body");
    const scroll = document.querySelector(".float-card-scroll");
    return {
      cardClass: card?.className,
      bodyH: body?.getBoundingClientRect?.()?.height,
      scrollH: scroll?.getBoundingClientRect?.()?.height,
      scrollHTML: (scroll?.innerHTML || "").slice(0, 800),
      routeSetup: !!document.querySelector(".plan-route-setup"),
      draft: !!document.querySelector(".trip-draft-panel"),
      draftText: document.querySelector(".trip-draft-title")?.textContent?.trim(),
      ask: document.querySelector(".plan-flow-question-title, .trip-draft-title")?.textContent?.trim(),
      boundary: document.querySelector(".error-boundary-msg, .error-boundary-title")?.textContent?.trim(),
      originVal: document.querySelector("#plan-route-origin")?.value,
      destVal: document.querySelector("#plan-route-dest")?.value,
      layout: document.querySelector(".plan-flow-current")?.className,
    };
  });
  console.log("AFTER", JSON.stringify(after, null, 2));
  console.log("ERRORS", errors);
  await page.screenshot({ path: "tmp/draft-first-walkthrough/diag-after.png", fullPage: false });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
