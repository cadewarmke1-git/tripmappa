/**
 * Full plan-flow visual walkthrough — screenshots + layout audit per step.
 * Run: node scripts/plan-flow-walkthrough-audit.mjs
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
const OUT_DIR = path.join(__dirname, "..", "tmp", "plan-flow-walkthrough");
const REPORT_PATH = path.join(OUT_DIR, "audit-report.json");

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

async function getStepName(page) {
  const title = page.locator(".plan-flow-question-title, .question-page-title").first();
  if (await title.isVisible({ timeout: 500 }).catch(() => false)) {
    return (await title.textContent())?.trim() || "unknown";
  }
  if (await page.locator(".plan-ready-screen, .btn-generate-trip").first().isVisible({ timeout: 500 }).catch(() => false)) {
    return "Ready — Generate My Trip";
  }
  if (await page.locator(".float-card--plan-flow").isVisible({ timeout: 500 }).catch(() => false)) {
    return "Plan panel (no question title)";
  }
  return "unknown";
}

async function auditCurrentStep(page, stepIndex) {
  await waitPlanStepReady(page).catch(() => {});
  await page.waitForTimeout(600);

  // Trip details: scroll budget + "More options" into view for accurate screenshot
  await page.evaluate(() => {
    const tripDetails = document.querySelector(".question-choices-trip-details");
    if (!tripDetails) return;
    const scroll = tripDetails.querySelector(".question-options-scroll");
    const budgetSection = [...tripDetails.querySelectorAll(".question-section-label")]
      .find(el => el.textContent?.trim() === "Budget")?.closest(".question-group-section");
    if (scroll && budgetSection) {
      const scrollRect = scroll.getBoundingClientRect();
      const targetRect = budgetSection.getBoundingClientRect();
      scroll.scrollTop += targetRect.top - scrollRect.top - 8;
    }
  }).catch(() => {});
  await page.waitForTimeout(300);

  const stepName = await getStepName(page);
  const slug = stepName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60);
  const shotPath = path.join(OUT_DIR, `${String(stepIndex).padStart(2, "0")}-${slug}.png`);

  const panel = page.locator(".float-card--plan-flow").first();
  await panel.screenshot({ path: shotPath }).catch(async () => {
    await page.screenshot({ path: shotPath, fullPage: false });
  });

  const metrics = await page.evaluate(() => {
    const panelEl = document.querySelector(".float-card--plan-flow");
    const scrollEl = document.querySelector(".plan-flow-form-body .convo-scroll")
      || document.querySelector(".float-card-scroll")
      || document.querySelector(".plan-flow-form-body");
    const optionsScroll = document.querySelector(".question-options-scroll");
    const clipRoot = optionsScroll || scrollEl;
    const stepHeader = document.querySelector(".plan-flow-step-label, .plan-flow-question-header");
    const stepLabelText = stepHeader?.textContent?.trim() || null;

    const panelRect = panelEl?.getBoundingClientRect();
    const panelWidth = panelRect ? Math.round(panelRect.width) : null;

    const scrollMetrics = scrollEl ? {
      clientHeight: scrollEl.clientHeight,
      scrollHeight: scrollEl.scrollHeight,
      needsScroll: scrollEl.scrollHeight > scrollEl.clientHeight + 2,
      scrollTop: scrollEl.scrollTop,
    } : null;

    const overflowTexts = [];
    const textCandidates = document.querySelectorAll(
      ".plan-flow-question-title, .question-page-title, .plan-option-card-label, .plan-choice-row, .float-card-title, .plan-route-card-endpoint, .preference-pill, .plan-flow-step-label",
    );
    textCandidates.forEach(el => {
      if (el.scrollWidth > el.clientWidth + 1) {
        overflowTexts.push({
          className: el.className,
          text: (el.textContent || "").trim().slice(0, 80),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    });

    const optionCards = [...document.querySelectorAll(".plan-option-card")].filter(card => {
      const collapsed = card.closest(".question-collapsible-panel:not(.is-open)");
      return !collapsed;
    });
    const optionMetrics = optionCards.map(card => {
      const rect = card.getBoundingClientRect();
      const clipR = clipRoot?.getBoundingClientRect() || panelEl?.getBoundingClientRect();
      const dockEl = document.querySelector(".plan-flow-dock");
      const dockTop = dockEl?.getBoundingClientRect().top ?? (clipR?.bottom ?? Infinity);
      const clipTop = clipR?.top ?? 0;
      const clippedBottom = rect.bottom > Math.min(clipR?.bottom ?? Infinity, dockTop) - 4;
      const clippedTop = rect.top < clipTop + 4 && rect.top < (panelEl?.getBoundingClientRect().top ?? 0) + 120;
      const label = card.querySelector(".plan-option-card-label")?.textContent?.trim() || "";
      return {
        label: label.slice(0, 60),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        clippedTop,
        clippedBottom,
        fullyVisible: !clippedTop && !clippedBottom,
      };
    });

    const pills = [...document.querySelectorAll(".preference-pill, .preference-pill-grid .pref-pill")];
    const pillMetrics = pills.map(p => {
      const rect = p.getBoundingClientRect();
      const panelR = panelEl?.getBoundingClientRect();
      return {
        text: (p.textContent || "").trim().slice(0, 40),
        clippedBottom: panelR ? rect.bottom > panelR.bottom - 4 : false,
      };
    });

    const tripDetailCards = document.querySelectorAll(".trip-details-section, .preference-section-card, .plan-details-card").length
      || document.querySelectorAll(".question-choices .plan-choice-row").length;

    const visibleTripDetailCards = [...document.querySelectorAll(".trip-details-section, .preference-section-card, .plan-details-card, .question-choices .plan-choice-row")]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      }).length;

    const dock = {
      back: Boolean(document.querySelector(".plan-flow-dock-back, .convo-nav-btn-back")),
      continue: Boolean(document.querySelector(".plan-flow-dock-continue")),
      skip: Boolean(document.querySelector(".plan-flow-dock-skip, .convo-nav-btn-skip")),
      generate: Boolean(document.querySelector(".btn-generate-trip")),
    };

    const planFlowCurrent = document.querySelector(".plan-flow-current");
    const currentHeight = planFlowCurrent ? Math.round(planFlowCurrent.getBoundingClientRect().height) : null;

    return {
      panelWidth,
      stepLabelText,
      scrollMetrics,
      overflowTexts,
      optionCards: optionMetrics,
      pills: pillMetrics,
      tripDetailCards: visibleTripDetailCards || tripDetailCards,
      preferencePillCount: pills.length,
      dock,
      planFlowCurrentHeight: currentHeight,
    };
  });

  const issues = [];

  if (metrics.panelWidth && (metrics.panelWidth < 820 || metrics.panelWidth > 900)) {
    issues.push({
      type: "panel-width",
      detail: `Panel width ${metrics.panelWidth}px (expected ~860px)`,
    });
  }

  if (metrics.scrollMetrics?.needsScroll) {
    const isTripDetails = /few more details|preferences|trip details/i.test(stepName);
    const isPreferences = /preferences|stops along|interests/i.test(stepName);
    if (!isTripDetails) {
      issues.push({
        type: "requires-scroll",
        detail: `Scroll area ${metrics.scrollMetrics.scrollHeight}px content in ${metrics.scrollMetrics.clientHeight}px container`,
      });
    }
  }

  if (metrics.overflowTexts.length) {
    issues.push({
      type: "text-overflow",
      detail: metrics.overflowTexts,
    });
  }

  const clippedOptions = metrics.optionCards.filter(c => !c.fullyVisible);
  if (clippedOptions.length) {
    issues.push({
      type: "clipped-options",
      detail: clippedOptions,
    });
  }

  if (/preferences|route preferences|looking for/i.test(stepName) && metrics.optionCards.length >= 7) {
    const clipped = metrics.optionCards.filter(c => !c.fullyVisible);
    if (clipped.length) {
      issues.push({
        type: "preferences-not-all-visible",
        detail: `${clipped.length} of ${metrics.optionCards.length} preference options clipped: ${clipped.map(c => c.label).join(", ")}`,
      });
    }
  }

  if (/few more details|trip details/i.test(stepName)) {
    if (metrics.tripDetailCards > 20 && !metrics.scrollMetrics?.needsScroll) {
      issues.push({
        type: "trip-details-wall",
        detail: `${metrics.tripDetailCards} detail cards visible without scroll — progressive disclosure may be broken`,
      });
    }
    if (metrics.tripDetailCards >= 35) {
      issues.push({
        type: "trip-details-too-many-visible",
        detail: `${metrics.tripDetailCards} cards visible at once (expected progressive disclosure)`,
      });
    }
  }

  if (metrics.planFlowCurrentHeight !== null && metrics.planFlowCurrentHeight < 80 && metrics.optionCards.length > 0) {
    issues.push({
      type: "container-height",
      detail: `.plan-flow-current height only ${metrics.planFlowCurrentHeight}px`,
    });
  }

  return {
    stepIndex,
    stepName,
    screenshot: shotPath,
    metrics,
    issues,
  };
}

async function advanceStep(page, stepName) {
  const name = stepName.toLowerCase();

  if (await page.locator(".btn-generate-trip").isVisible({ timeout: 500 }).catch(() => false)) {
    return "done";
  }

  if (await page.locator(".question-choices-trip-details").isVisible({ timeout: 500 }).catch(() => false)) {
    const skipDefaults = page.getByRole("button", { name: /Defaults are fine|Skip for now|Use defaults/i });
    if (await skipDefaults.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipDefaults.first().click({ force: true });
      await page.waitForTimeout(400);
      return "advanced";
    }
    const cont = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
    if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cont.click({ force: true });
      await page.waitForTimeout(400);
      return "advanced";
    }
  }

  if (/anything else|few more details|trip details|food|budget|more details/i.test(name)) {
    const skipDefaults = page.getByRole("button", { name: /Defaults are fine|Skip for now|Use defaults/i });
    if (await skipDefaults.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipDefaults.first().click({ force: true });
      await page.waitForTimeout(400);
      return "advanced";
    }
    const cont = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
    if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cont.click({ force: true });
      await page.waitForTimeout(400);
      return "advanced";
    }
  }

  if (/few more details|trip details/i.test(name)) {
    const skip = page.getByRole("button", { name: /Skip for now|Use defaults|Defaults are fine/i });
    if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skip.first().click();
      await page.waitForTimeout(400);
    }
    const cont = page.locator(".plan-flow-dock-continue").first();
    if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cont.click({ force: true });
      await page.waitForTimeout(400);
    }
    return "advanced";
  }

  if (/route preferences/i.test(name)) {
    const cont = page.locator(".plan-flow-dock-continue, .plan-flow-dock-skip").first();
    if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cont.click({ force: true });
      await page.waitForTimeout(500);
      return "advanced";
    }
  }

  if (/scenic|overnight|optional/i.test(name)) {
    const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
    if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skip.click();
      return "advanced";
    }
  }

  const picks = [
    "Car",
    "Gasoline",
    "No",
    "Just me",
    "Just one stop",
    "Drive straight through",
  ];

  for (const label of picks) {
    if (await pickPlanOption(page, label)) {
      await page.waitForTimeout(400);
      return "advanced";
    }
  }

  const firstCard = page.locator(".plan-option-card").first();
  if (await firstCard.isVisible({ timeout: 1500 }).catch(() => false)) {
    await firstCard.click({ force: true });
    return "advanced";
  }

  const cont = page.locator(".plan-flow-dock-continue").first();
  if (await cont.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cont.click({ force: true });
    return "advanced";
  }

  const skip = page.locator(".plan-flow-dock-skip").first();
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skip.click();
    return "advanced";
  }

  return "stuck";
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const env = loadEnvLocal();
  const email = process.env.PLAYWRIGHT_ADMIN_EMAIL || env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com";
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD || env.PLAYWRIGHT_ADMIN_PASSWORD || env.ADMIN_PASSWORD;
  if (!password) {
    console.error("Missing PLAYWRIGHT_ADMIN_PASSWORD or ADMIN_PASSWORD in .env.local");
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await installGoogleApiMocks(page);

  await signIn(page, email, password);

  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-go-btn").click();
  await page.locator(".float-card--plan-flow").waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(1500);

  const reports = [];
  let stepIndex = 1;
  let lastStepName = "";
  let stuckCount = 0;

  while (stepIndex <= 25) {
    const report = await auditCurrentStep(page, stepIndex);
    reports.push(report);
    console.log(`Step ${stepIndex}: ${report.stepName}`);
    if (report.issues.length) {
      report.issues.forEach(i => console.log(`  ISSUE [${i.type}]: ${typeof i.detail === "string" ? i.detail : JSON.stringify(i.detail).slice(0, 120)}`));
    }

    if (await page.locator(".btn-generate-trip").isVisible({ timeout: 500 }).catch(() => false)) {
      const readyReport = await auditCurrentStep(page, stepIndex + 1);
      reports.push(readyReport);
      console.log(`Step ${stepIndex + 1}: ${readyReport.stepName}`);
      break;
    }

    const result = await advanceStep(page, report.stepName);
    if (result === "done") break;
    if (result === "stuck") {
      stuckCount += 1;
      if (stuckCount >= 3) {
        console.log("Stuck — stopping walkthrough");
        break;
      }
    } else {
      stuckCount = 0;
    }

    const newName = await getStepName(page);
    if (newName === lastStepName && result !== "advanced") {
      stuckCount += 1;
    }
    lastStepName = newName;
    stepIndex += 1;
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(reports, null, 2));

  const allIssues = reports.flatMap(r => r.issues.map(i => ({ step: r.stepName, ...i })));
  console.log("\n=== SUMMARY ===");
  console.log(`Steps audited: ${reports.length}`);
  console.log(`Issues found: ${allIssues.length}`);
  allIssues.forEach(i => {
    console.log(`- [${i.step}] ${i.type}: ${typeof i.detail === "string" ? i.detail : JSON.stringify(i.detail)}`);
  });
  console.log(`Report: ${REPORT_PATH}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
