/** Capture verification screenshots for plan flow + navigate fixes */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";
import {
  closeAutocomplete,
  pickPlanOption,
  pickStopCount,
  waitPlanStepReady,
} from "../e2e/helpers/planFlowHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const OUT_DIR = path.join(__dirname, "..", "tmp", "fix-verify-screenshots");

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, "utf8")
      .split(/\r?\n/)
      .filter(line => line && !line.startsWith("#") && line.includes("="))
      .map(line => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      }),
  );
}

async function signInAsAdmin(page, email, password) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const trigger = page.locator(".profile-card-trigger").first();
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  if (await page.locator(".profile-card-signout").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    return;
  }
  await page.getByRole("button", { name: "Sign In", exact: true }).click({ timeout: 10_000 });
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.locator(".auth-modal").waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {});
  await page.keyboard.press("Escape");
}

async function startPlanFlow(page) {
  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-go-btn").click();
  await page.locator(".float-card--plan-flow").waitFor({ state: "visible", timeout: 45_000 });
  await waitPlanStepReady(page).catch(() => {});
  await page.waitForTimeout(1500);
}

async function advanceToPreferences(page) {
  await pickPlanOption(page, "Car");
  await waitPlanStepReady(page).catch(() => {});
  await pickPlanOption(page, "Gasoline");
  await waitPlanStepReady(page).catch(() => {});
  await pickPlanOption(page, "No");
  await waitPlanStepReady(page).catch(() => {});
  await pickPlanOption(page, "Just me");
  await waitPlanStepReady(page).catch(() => {});
  await pickStopCount(page);
  await waitPlanStepReady(page).catch(() => {});
  await page.waitForTimeout(1000);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnvLocal();
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL || env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com";
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD || env.PLAYWRIGHT_ADMIN_PASSWORD || env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Missing PLAYWRIGHT_ADMIN_PASSWORD");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installGoogleApiMocks(page);
  await page.route("**/api/plan-trip", route => route.abort("blockedbyclient"));

  await signInAsAdmin(page, email, password);
  await startPlanFlow(page);
  await page.screenshot({ path: path.join(OUT_DIR, "vehicle-step-1280x800.png") });

  const vehicleMetrics = await page.evaluate(() => ({
    panelWidth: document.querySelector(".float-card--plan-flow:not(.collapsed)")?.getBoundingClientRect()?.width,
    cardCount: document.querySelectorAll(".plan-option-card").length,
    title: document.querySelector(".plan-flow-question-title")?.textContent?.trim(),
  }));

  await advanceToPreferences(page);
  await page.screenshot({ path: path.join(OUT_DIR, "preferences-step-1280x800.png") });

  const prefMetrics = await page.evaluate(() => ({
    panelWidth: document.querySelector(".float-card--plan-flow:not(.collapsed)")?.getBoundingClientRect()?.width,
    pillCount: document.querySelectorAll(".plan-option-card, .pref-pill, .preference-pill").length,
    scrollHeight: document.querySelector(".question-options-scroll")?.getBoundingClientRect()?.height,
    choicesVisible: document.querySelector(".question-choices-shell-compact")?.getBoundingClientRect()?.height,
    title: document.querySelector(".plan-flow-question-title")?.textContent?.trim(),
    cardRects: [...document.querySelectorAll(".plan-option-card")].slice(0, 2).map((c) => {
      const r = c.getBoundingClientRect();
      return { h: r.height, w: r.width, top: r.top, text: c.textContent?.trim()?.slice(0, 20) };
    }),
    scrollTops: {
      floatCard: document.querySelector(".float-card-scroll")?.scrollTop,
      formBody: document.querySelector(".plan-flow-form-body")?.scrollTop,
      options: document.querySelector(".question-options-scroll")?.scrollTop,
    },
    stepRect: document.querySelector(".plan-flow-current")?.getBoundingClientRect(),
  }));

  await page.getByRole("button", { name: "Navigate", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "navigate-tab-1280x800.png") });

  const navMetrics = await page.evaluate(() => ({
    hasOrigin: !!document.querySelector("#navigate-origin"),
    hasDest: !!document.querySelector("#navigate-dest"),
    hasGoBtn: !!document.querySelector(".navigate-route-go"),
    panelVisible: document.querySelector(".navigate-route-panel")?.getBoundingClientRect()?.height > 0,
  }));

  await page.screenshot({ path: path.join(OUT_DIR, "navbar-right-1280x800.png"), clip: { x: 900, y: 0, width: 380, height: 80 } });

  const navbarMetrics = await page.evaluate(() => {
    const right = document.querySelector(".app-nav-bar-right");
    const rect = right?.getBoundingClientRect();
    return {
      rightLeft: rect?.left,
      rightRight: rect?.right,
      viewportWidth: window.innerWidth,
      inViewport: rect ? rect.right <= window.innerWidth && rect.left >= 0 : false,
    };
  });

  const report = { vehicleMetrics, prefMetrics, navMetrics, navbarMetrics, outDir: OUT_DIR };
  fs.writeFileSync(path.join(OUT_DIR, "metrics.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
