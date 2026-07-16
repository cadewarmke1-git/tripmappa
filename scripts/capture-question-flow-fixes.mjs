/** Capture mid-flow question step + ready screen after panel fixes. */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT_DIR = "tmp/screenshots";
const PREVIEW_PORT = 4176;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Preview server did not start at ${url}`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function startPreview() {
  return spawn("npm", ["run", "preview", "--", "--port", String(PREVIEW_PORT), "--host", "127.0.0.1"], {
    stdio: "pipe",
    shell: true,
  });
}

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

async function startPlanFlow(page) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`);
  await page.waitForTimeout(900);
  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  const goBtn = page.locator(".hero-go-btn");
  await goBtn.waitFor({ state: "visible", timeout: 90_000 });
  await goBtn.click();
  await page.locator(".float-card--plan-flow").waitFor({ state: "visible", timeout: 45_000 });
}

async function pickPlanOption(page, label) {
  const card = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: label, exact: true }),
  }).first();
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const btn = page.getByRole("button", { name: label, exact: true });
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}

async function waitPlanStepReady(page) {
  await page.locator(".question-choices.choices-frozen").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function pickStopCount(page) {
  if (await pickPlanOption(page, "Just one stop")) return true;
  if (await pickPlanOption(page, "A few (2-3)")) return true;
  return pickPlanOption(page, "Surprise me");
}

async function skipOptionalSteps(page) {
  const scenic = page.locator(".plan-option-card-label", { hasText: "Scenic route" }).first();
  if (await scenic.isVisible({ timeout: 4000 }).catch(() => false)) {
    const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
    if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  }
  if (await pickPlanOption(page, "Drive straight through")) {
    await page.waitForTimeout(400);
  }
  const overnight = page.getByRole("button", { name: /overnight/i });
  if (await overnight.isVisible({ timeout: 3000 }).catch(() => false)) {
    const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
    if (await skip.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  }
}

async function finishTripDetails(page) {
  const skipDefaults = page.getByRole("button", { name: /Skip for now|Use defaults|Defaults are fine/i });
  if (await skipDefaults.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipDefaults.first().click();
    await page.waitForTimeout(400);
  }
  const continueBtn = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
  if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(400);
  }
}

async function completeCarFlow(page) {
  await pickPlanOption(page, "Car");
  await waitPlanStepReady(page);
  await pickPlanOption(page, "Gasoline");
  await waitPlanStepReady(page);
  await pickPlanOption(page, "No");
  await waitPlanStepReady(page);
  await pickPlanOption(page, "Just me");
  await waitPlanStepReady(page);
  await pickStopCount(page);
  await waitPlanStepReady(page);
  await skipOptionalSteps(page);
  await page.locator(".plan-flow-question-title, .question-page-title").filter({ hasText: "A few more details" }).waitFor({ timeout: 20_000 });
  await finishTripDetails(page);
  await page.locator(".btn-generate-trip-ready, .plan-ready-screen").first().waitFor({ state: "visible", timeout: 25_000 });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await startPlanFlow(page);
    await page.locator(".plan-flow-question-title").first().waitFor({ state: "visible", timeout: 20_000 });
    await page.waitForTimeout(600);
    await page.locator(".float-card--plan-flow").screenshot({ path: `${OUT_DIR}/question-flow-mid-step-desktop.png` });

    await completeCarFlow(page);
    await page.waitForTimeout(800);
    await page.locator(".plan-flow-answer-summary").waitFor({ state: "visible", timeout: 10_000 });
    await page.locator(".btn-generate-trip-ready").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.locator(".float-card--plan-flow").screenshot({ path: `${OUT_DIR}/question-flow-ready-desktop.png` });

    await browser.close();
    console.log("Screenshots saved to", OUT_DIR);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
