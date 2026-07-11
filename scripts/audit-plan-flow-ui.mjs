/**
 * One-off Playwright audit: plan flow UI issues on localhost preview.
 * Does NOT call /api/plan-trip. Google Maps requests are mocked.
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";
import {
  closeAutocomplete,
  pickPlanOption,
  pickStopCount,
  skipOptionalSteps,
  waitPlanStepReady,
} from "../e2e/helpers/planFlowHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const OUT_DIR = path.join(__dirname, "..", "tmp", "plan-flow-audit");

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

async function dismissOverlays(page) {
  for (const sel of [".founder-welcome-overlay", ".traveler-onboarding", ".upgrade-modal-overlay"]) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }
}

async function readStepSnapshot(page) {
  return page.evaluate(() => {
    const panel = document.querySelector(".float-card--plan-flow:not(.collapsed)");
    const title = document.querySelector(".plan-flow-question-title, .question-page-title");
    const stepLabel = document.querySelector(".plan-flow-step-label");
    const choices = document.querySelector(".question-choices");
    const cards = [...document.querySelectorAll(".plan-option-card")].map(c => c.querySelector(".plan-option-card-label")?.textContent?.trim()).filter(Boolean);
    const buttons = [...document.querySelectorAll(".question-choices button, .question-choices .qr-btn")].slice(0, 12).map(b => b.textContent?.trim()).filter(Boolean);
    const loading = !!document.querySelector(".question-loading");
    const textInput = document.querySelector(".question-choices input[type='text'], .question-choices textarea");
    const tripDetailsSections = [...document.querySelectorAll(".question-group-section")].map(s => s.querySelector(".question-group-label")?.textContent?.trim()).filter(Boolean);
    const cardStyle = document.querySelector(".plan-option-card");
    const cs = cardStyle ? getComputedStyle(cardStyle) : null;
    const map = document.querySelector(".gmap-wrap, .map-full");
    const mapCanvas = document.querySelector(".gm-style > div");
    return {
      layout: document.documentElement.getAttribute("data-layout"),
      panelWidth: panel ? Math.round(panel.getBoundingClientRect().width) : null,
      mainWidth: document.querySelector(".plan-flow-main")?.getBoundingClientRect()?.width ?? null,
      sidebarWidth: document.querySelector(".plan-flow-answer-sidebar")?.getBoundingClientRect()?.width ?? null,
      gridWidth: document.querySelector(".plan-option-grid")?.getBoundingClientRect()?.width ?? null,
      cardBg: cs?.backgroundColor ?? null,
      cardCount: document.querySelectorAll(".plan-option-card").length,
      title: title?.textContent?.trim() ?? "",
      stepLabel: stepLabel?.textContent?.trim() ?? "",
      loading,
      cards,
      buttons: buttons.slice(0, 8),
      tripDetailsSections,
      hasTextInput: !!textInput,
      choicesHtmlLen: choices?.innerHTML?.length ?? 0,
      choicesVisible: choices ? choices.getBoundingClientRect().height : 0,
      mapVisible: map ? map.getBoundingClientRect().width > 0 : false,
      mapZoom: window.__auditMapZoom ?? null,
    };
  });
}

async function pickBestOption(page, snap) {
  if (snap.loading) {
    await page.waitForTimeout(1500);
    return false;
  }
  if (snap.title.includes("A few more details") || snap.tripDetailsSections.length) {
    const skip = page.getByRole("button", { name: /Skip for now|Use defaults|Defaults are fine/i });
    if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skip.first().click();
      await page.waitForTimeout(400);
      return true;
    }
    const cont = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
    if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cont.click();
      await page.waitForTimeout(400);
      return true;
    }
    return false;
  }
  const prefs = ["Car", "Gasoline", "No", "Just me", "Just one stop", "Drive straight through", "Hotels", "1 night", "No budget limit"];
  for (const label of prefs) {
    if (snap.cards.includes(label) || snap.buttons.some(b => b.includes(label))) {
      if (await pickPlanOption(page, label)) {
        await waitPlanStepReady(page).catch(() => {});
        return true;
      }
    }
  }
  if (await pickStopCount(page)) {
    await waitPlanStepReady(page).catch(() => {});
    return true;
  }
  await skipOptionalSteps(page);
  const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(400);
    return true;
  }
  const firstCard = page.locator(".plan-option-card").first();
  if (await firstCard.isVisible({ timeout: 1000 }).catch(() => false)) {
    await firstCard.click();
    await waitPlanStepReady(page).catch(() => {});
    return true;
  }
  const firstBtn = page.locator(".question-choices .qr-btn, .question-choices button").first();
  if (await firstBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await firstBtn.click();
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnvLocal();
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL || env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com";
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD || env.PLAYWRIGHT_ADMIN_PASSWORD || env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Missing PLAYWRIGHT_ADMIN_PASSWORD in .env.local");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installGoogleApiMocks(page);

  await page.route("**/api/plan-trip", route => route.abort("blockedbyclient"));
  await page.route("**/api/truck-routing**", route => route.abort("blockedbyclient"));

  await signInAsAdmin(page, email, password);
  await dismissOverlays(page);

  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-go-btn").click();
  await page.locator(".float-card--plan-flow").waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    window.__auditMapZoom = null;
    const hook = setInterval(() => {
      const mapEl = document.querySelector(".gm-style");
      if (!mapEl) return;
      const gmap = window.google?.maps;
      if (!gmap) return;
      for (const key of Object.keys(window)) {
        try {
          const v = window[key];
          if (v && typeof v.getZoom === "function" && v.getDiv?.()?.closest?.(".gmap-wrap, .map-full")) {
            window.__auditMapZoom = v.getZoom();
            clearInterval(hook);
            break;
          }
        } catch { /* ignore */ }
      }
    }, 500);
    setTimeout(() => clearInterval(hook), 15000);
  });

  const steps = [];
  const maxSteps = 20;
  for (let i = 0; i < maxSteps; i++) {
    const snap = await readStepSnapshot(page);
    const blank = !snap.loading
      && snap.cardCount === 0
      && snap.tripDetailsSections.length === 0
      && !snap.hasTextInput
      && snap.choicesVisible < 40
      && snap.choicesHtmlLen < 200;
    steps.push({ step: i + 1, blank, ...snap });
    await page.screenshot({ path: path.join(OUT_DIR, `step-${String(i + 1).padStart(2, "0")}.png`), fullPage: false });
    if (snap.title.includes("Ready to generate") || await page.locator(".btn-generate-trip").isVisible({ timeout: 500 }).catch(() => false)) {
      break;
    }
    const advanced = await pickBestOption(page, snap);
    if (!advanced) {
      steps.push({ step: i + 1, stuck: true });
      break;
    }
    await page.waitForTimeout(800);
  }

  fs.writeFileSync(path.join(OUT_DIR, "audit.json"), JSON.stringify({ base: BASE, email, steps }, null, 2));
  console.log(JSON.stringify({ outDir: OUT_DIR, steps: steps.map(s => ({
    step: s.step,
    title: s.title,
    stepLabel: s.stepLabel,
    blank: s.blank,
    panelWidth: s.panelWidth,
    mainWidth: s.mainWidth,
    cardBg: s.cardBg,
    cardCount: s.cardCount,
    mapZoom: s.mapZoom,
    cards: s.cards?.slice(0, 4),
  })) }, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
