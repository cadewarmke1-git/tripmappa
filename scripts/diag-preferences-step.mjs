/**
 * Focused layout diagnosis for the preferences (multiselect/tall) step.
 * Run: node scripts/diag-preferences-step.mjs
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";
import {
  closeAutocomplete,
  pickPlanOption,
  waitPlanStepReady,
} from "../e2e/helpers/planFlowHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const OUT_DIR = path.join(__dirname, "..", "tmp", "preferences-diag");

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

async function signIn(page, email, password) {
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

async function advanceToPreferences(page) {
  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-go-btn").click();
  await page.locator(".float-card--plan-flow").waitFor({ timeout: 45_000 });

  const picks = ["Car", "Gasoline", "No", "Just me", "Just one stop", "Drive straight through"];
  for (let i = 0; i < 20; i++) {
    await waitPlanStepReady(page).catch(() => {});
    await page.waitForTimeout(500);

    const title = await page.locator(".plan-flow-question-title").first().textContent().catch(() => "");
    if (/route preferences|RV preferences/i.test(title || "")) {
      return title?.trim();
    }

    let advanced = false;
    for (const label of picks) {
      if (await pickPlanOption(page, label)) {
        advanced = true;
        break;
      }
    }
    if (!advanced) {
      const cont = page.locator(".plan-flow-dock-continue, .plan-flow-dock-skip").first();
      if (await cont.isVisible({ timeout: 800 }).catch(() => false)) {
        await cont.click({ force: true });
        advanced = true;
      }
    }
    if (!advanced) break;
    picks.shift();
  }

  await waitPlanStepReady(page).catch(() => {});
  await page.waitForTimeout(800);
  return (await page.locator(".plan-flow-question-title").first().textContent())?.trim() || "unknown";
}

function measureEl(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    offsetHeight: el.offsetHeight,
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    rectHeight: Math.round(r.height),
    rectTop: Math.round(r.top),
    rectBottom: Math.round(r.bottom),
    display: cs.display,
    flex: cs.flex,
    flexGrow: cs.flexGrow,
    flexShrink: cs.flexShrink,
    flexBasis: cs.flexBasis,
    minHeight: cs.minHeight,
    maxHeight: cs.maxHeight,
    height: cs.height,
    overflow: cs.overflow,
    overflowY: cs.overflowY,
    visibility: cs.visibility,
    opacity: cs.opacity,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnvLocal();
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL || env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com";
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD || env.PLAYWRIGHT_ADMIN_PASSWORD || env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Missing password in .env.local");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installGoogleApiMocks(page);
  await signIn(page, email, password);
  const stepTitle = await advanceToPreferences(page);

  const report = await page.evaluate(() => {
    const chain = [
      ".float-card--plan-flow",
      ".float-card-body--plan-flow",
      ".float-card-scroll",
      ".plan-flow-form",
      ".plan-flow-form-body",
      ".plan-flow-stack",
      ".plan-flow-body",
      ".plan-flow-main",
      ".plan-flow-current",
      ".question-choices-shell-compact",
      ".question-choices-compact",
      ".question-options-scroll",
      ".plan-option-grid",
    ];

    function measureEl(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        offsetHeight: el.offsetHeight,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        rectHeight: Math.round(r.height),
        rectTop: Math.round(r.top),
        rectBottom: Math.round(r.bottom),
        display: cs.display,
        flex: cs.flex,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        height: cs.height,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        visibility: cs.visibility,
        opacity: cs.opacity,
      };
    }

    const current = document.querySelector(".plan-flow-current");
    const layoutClass = current?.className.match(/plan-flow-layout--\w+/)?.[0] || null;

    const pills = [...document.querySelectorAll(".plan-option-card")].map(card => {
      const r = card.getBoundingClientRect();
      const label = card.querySelector(".plan-option-card-label")?.textContent?.trim();
      const panel = document.querySelector(".float-card--plan-flow")?.getBoundingClientRect();
      const clipRoot = document.querySelector(".question-options-scroll")
        || document.querySelector(".question-choices-compact")
        || document.querySelector(".plan-flow-current");
      const clip = clipRoot?.getBoundingClientRect();
      const fullyVisible = clip
        ? r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1 && r.height > 0
        : r.height > 0;
      return {
        label,
        height: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        fullyVisible,
        inPanel: panel ? r.bottom <= panel.bottom && r.top >= panel.top : null,
      };
    });

    const chainMetrics = {};
    for (const sel of chain) {
      chainMetrics[sel] = measureEl(document.querySelector(sel));
    }

    const zeroHeight = Object.entries(chainMetrics)
      .filter(([, m]) => m && (m.offsetHeight === 0 || m.rectHeight === 0))
      .map(([sel]) => sel);

    const hiddenOverflowParents = chain
      .map(sel => ({ sel, el: document.querySelector(sel) }))
      .filter(({ el }) => el && (getComputedStyle(el).overflow === "hidden" || getComputedStyle(el).overflowY === "hidden"))
      .map(({ sel, el }) => ({
        sel,
        height: el.offsetHeight,
        scrollHeight: el.scrollHeight,
        clipsContent: el.scrollHeight > el.clientHeight + 2,
      }));

    return {
      stepTitle: document.querySelector(".plan-flow-question-title")?.textContent?.trim(),
      layoutClass,
      dataLayout: document.documentElement.getAttribute("data-layout"),
      pillCount: pills.length,
      pills,
      chainMetrics,
      zeroHeight,
      hiddenOverflowParents,
      planFlowCurrent: measureEl(document.querySelector(".plan-flow-current")),
      planFlowFormBody: measureEl(document.querySelector(".plan-flow-form-body")),
      optionsContainer: measureEl(
        document.querySelector(".question-options-scroll")
          || document.querySelector(".plan-option-grid")
          || document.querySelector(".question-choices-compact"),
      ),
    };
  });

  report.navigatedTo = stepTitle;
  const shotPath = path.join(OUT_DIR, "preferences-step.png");
  await page.locator(".float-card--plan-flow").first().screenshot({ path: shotPath });
  report.screenshot = shotPath;

  const reportPath = path.join(OUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
