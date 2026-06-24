/**
 * Visual regression sweep — 13 vehicles × 2 viewports, screenshot each plan step.
 * Google Maps / Places / Geocoding / Directions calls are mocked (no live Google traffic).
 * TripMappa backend (/api/plan-trip, etc.) uses real server logic.
 *
 * Run: node scripts/visual-regression-sweep.mjs
 * Requires: dev server on 5173, e2e/.auth/user.json (optional but recommended)
 *
 * Env:
 *   SWEEP_FILTER=desktop/Car,mobile/RV  — run subset only
 *   SWEEP_STOP_AT=ready                 — skip Generate click and results wait
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  getNextFlowQuestion,
  isRouteContextReady,
  MULTI_VEHICLE_TRIP,
} from "../src/lib/tripFlow.js";
import { OVERNIGHT_PREFERENCE_OVERNIGHT } from "../src/lib/driveMode.js";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";

const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:5173";
const AUTH = path.join(process.cwd(), "e2e", ".auth", "user.json");
const OUT_ROOT = path.join(process.cwd(), "visual-regression-sweep");
const STOP_AT = process.env.SWEEP_STOP_AT || "";
const FILTER = process.env.SWEEP_FILTER
  ? new Set(process.env.SWEEP_FILTER.split(",").map(s => s.trim()).filter(Boolean))
  : null;

const VIEWPORTS = [
  { key: "desktop", width: 1280, height: 800 },
  { key: "mobile", width: 375, height: 812 },
];

const VEHICLES = [
  { key: "Car", value: "Car", tab: "Personal", button: "Car" },
  { key: "Motorcycle", value: "Motorcycle", tab: "Personal", button: "Motorcycle" },
  { key: "SUV-Van", value: "SUV or Van", tab: "Personal", button: "SUV or Van" },
  { key: "RV", value: "RV", tab: "Oversized", button: "RV" },
  { key: "Camper-Van", value: "Camper Van", tab: "Oversized", button: "Camper Van" },
  { key: "Semi-Truck", value: "Semi Truck (18-wheeler)", tab: "Commercial", button: "Semi Truck 18-Wheeler" },
  { key: "Flatbed", value: "Flatbed", tab: "Commercial", button: "Flatbed" },
  { key: "Tanker", value: "Tanker", tab: "Commercial", button: "Tanker" },
  { key: "Box-Truck", value: "Box Truck", tab: "Commercial", button: "Box Truck" },
  { key: "Boat", value: "Boat", tab: "Other", button: "Boat" },
  { key: "Ferry", value: "Ferry", tab: "Other", button: "Ferry" },
  { key: "Plane", value: "Plane", tab: "Other", button: "Plane" },
  { key: "Multi-Vehicle", value: MULTI_VEHICLE_TRIP, tab: "More", button: "Multi-Vehicle Trip" },
];

/** Matches mocked Dallas → Houston directions (~239 mi, ~3.5 hr). */
const ROUTE_CONTEXT = {
  routeDistance: "239 mi",
  routeDuration: "3 hours 30 mins",
  routeDistanceMiles: 239,
  routeDurationHours: 3.5,
};

function slug(s) {
  return String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pickTripDetailsPatch(q) {
  const hasDestInterests = q.sections?.some(s => s.id === "stops_interests");
  return {
    dietary: [],
    stops_interests: hasDestInterests ? ["Cities and culture"] : [],
    accessibility: [],
    schedule_restrictions: ["No restrictions"],
    trip_budget: "No budget limit",
  };
}

function applySimAnswer(q, answers) {
  if (!q || q.done) return answers;
  if (q.type === "trip_details") return { ...answers, ...pickTripDetailsPatch(q) };
  if (q.type === "lodging_stay") return { ...answers, lodging: "Mid-Range", loyalty_program: "No preference" };
  if (q.id === "primary_vehicle") return { ...answers, primary_vehicle: "Car" };
  if (q.id === "overnight_preference") return { ...answers, overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT };
  if (q.id === "multi_vehicles") return { ...answers, multi_vehicles: ["Car", "RV"] };
  if (q.id === "route_restrictions") return { ...answers, route_restrictions: ["No restrictions"] };
  if (q.id === "coordination_needs") return { ...answers, coordination_needs: ["Stay together the whole way"] };
  if (q.id === "preferences") return { ...answers, preferences: [] };
  if (q.id === "stop_count") return { ...answers, stop_count: "A few (2-3)" };
  if (q.id === "travelers") return { ...answers, travelers: "Just me" };
  if (q.type === "party_composition") return { ...answers, adult_count: 1, child_count: 0 };
  if (q.id === "lodging" && q.type === "choice") return { ...answers, lodging: "Mid-range hotel" };
  if (q.id === "trip_nights") return { ...answers, trip_nights: "2 nights" };
  if (q.id === "food_allergies") return { ...answers, food_allergies: "None specified" };
  if (q.id === "schedule_drive_hours") return { ...answers, schedule_drive_hours: "Any reasonable hours" };
  if (q.type === "multiselect") {
    return { ...answers, [q.id]: q.choices?.includes("No restrictions") ? ["No restrictions"] : (q.choices?.length ? [q.choices[0]] : []) };
  }
  if (q.type === "text") return { ...answers, [q.id]: "none" };
  if (Array.isArray(q.choices) && q.choices.length) {
    const first = q.choices[0];
    const val = typeof first === "object" ? first.value : first;
    return { ...answers, [q.id]: val };
  }
  return { ...answers, [q.id]: "Yes" };
}

function uiLabelForValue(q, value) {
  if (q.type === "vehicle") return null;
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return String(value);
  if (q.choices?.length && typeof q.choices[0] === "object") {
    const hit = q.choices.find(c => c.value === value);
    if (hit) return hit.label || hit.value;
  }
  return value;
}

async function closeProfileMenu(page) {
  const open = page.locator(".profile-card-dropdown.is-open");
  if (await open.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await sleep(200);
  }
}

async function fillHeroInput(page, index, value) {
  const input = page.locator(".hero-input").nth(index);
  await input.click();
  await input.fill(value);
  await input.dispatchEvent("input");
  await input.dispatchEvent("change");
}

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await sleep(150);
}

async function waitForChoicesUnlocked(page) {
  const loading = page.locator(".question-pending-note--loading");
  if (await loading.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await loading.waitFor({ state: "hidden", timeout: 25_000 }).catch(() => {});
  }
  const skip = page.locator(".question-skip-route-link");
  if (await skip.isVisible({ timeout: 500 }).catch(() => false)) {
    await skip.click();
    await sleep(400);
  }
}

async function auditVisuals(page, isMobile) {
  return page.evaluate((mobile) => {
    const issues = [];
    const minTap = mobile ? 44 : 36;

    function parseRgb(str) {
      const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    function lum([r, g, b]) {
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function contrast(fg, bg) {
      const l1 = lum(fg);
      const l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }
    function bgColor(el) {
      let node = el;
      while (node && node !== document.body) {
        const bg = getComputedStyle(node).backgroundColor;
        const rgb = parseRgb(bg);
        if (rgb && bg !== "rgba(0, 0, 0, 0)") return rgb;
        node = node.parentElement;
      }
      return [10, 12, 24];
    }

    const selectors = [
      ".question-page-title",
      ".qr-btn-label",
      ".qr-btn",
      ".vehicle-tab",
      ".app-nav-mode-btn",
      ".hero-explore-range-label",
      ".plan-route-card-chip",
      ".btn-generate-trip",
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;

        if (el.scrollWidth > el.clientWidth + 2) {
          issues.push({ kind: "text-overflow", selector: sel, text: (el.textContent || "").trim().slice(0, 60) });
        }

        if (sel.includes("btn") || sel.includes("tab") || sel.includes("qr-btn")) {
          if (rect.height < minTap - 2 || rect.width < minTap - 2) {
            issues.push({
              kind: "small-target",
              selector: sel,
              size: `${Math.round(rect.width)}×${Math.round(rect.height)}px`,
              label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
            });
          }
        }

        const fg = parseRgb(cs.color);
        if (fg) {
          const ratio = contrast(fg, bgColor(el));
          if (ratio < 4.5 && (el.textContent || "").trim().length > 0) {
            issues.push({ kind: "low-contrast", selector: sel, ratio: Math.round(ratio * 10) / 10, text: (el.textContent || "").trim().slice(0, 50) });
          }
        }
      });
    }

    return issues;
  }, isMobile);
}

async function screenshotScreen(page, dir, name, screenName, manifest, caseIssues, isMobile) {
  await sleep(400);
  const file = `${String(manifest.screens.length + 1).padStart(2, "0")}-${slug(name)}.png`;
  const rel = path.join(path.basename(path.dirname(dir)), path.basename(dir), file).replace(/\\/g, "/");
  await page.screenshot({ path: path.join(dir, file), fullPage: false });
  const auto = await auditVisuals(page, isMobile);
  for (const issue of auto) caseIssues.push({ screen: screenName, ...issue });
  manifest.screens.push({ file: rel, screen: screenName, autoIssues: auto.length });
}

async function clickChoiceButton(page, label) {
  await closeProfileMenu(page);
  await waitForChoicesUnlocked(page);
  const btn = page.getByRole("button", { name: label, exact: true });
  await btn.click({ timeout: 20_000 });
  await sleep(350);
}

async function answerQuestionInUI(page, q, answers, vehicleCase) {
  await closeProfileMenu(page);

  if (q.id === "vehicle") {
    if (vehicleCase.tab) {
      await page.getByRole("tab", { name: vehicleCase.tab, exact: true }).click({ timeout: 15_000 });
      await sleep(250);
    }
    await clickChoiceButton(page, vehicleCase.button);
    await page.locator(".plan-flow-actions .btn-generate-inline").click();
    await sleep(400);
    return;
  }

  if (q.id === "multi_vehicles") {
    await clickChoiceButton(page, "Car");
    await clickChoiceButton(page, "RV");
    await page.locator(".plan-flow-actions .btn-generate-inline").click();
    await sleep(400);
    return;
  }

  if (q.id === "primary_vehicle") {
    await clickChoiceButton(page, "Car");
    return;
  }

  if (q.type === "trip_details") {
    const defaults = page.locator(".plan-flow-actions .convo-nav-btn-defaults");
    if (await defaults.isVisible().catch(() => false)) await defaults.click();
    else await page.locator(".plan-flow-actions .btn-generate-inline").click();
    await sleep(450);
    return;
  }

  if (q.type === "party_composition") {
    await page.locator(".plan-flow-actions .btn-generate-inline").click();
    await sleep(400);
    return;
  }

  if (q.type === "multiselect") {
    const vals = answers[q.id] || [];
    for (const v of vals) await clickChoiceButton(page, v);
    await page.locator(".plan-flow-actions .btn-generate-inline").click();
    await sleep(400);
    return;
  }

  if (q.type === "multiselect_group") {
    await page.locator(".plan-flow-actions .convo-nav-btn").filter({ hasText: "Nothing special" }).click().catch(async () => {
      await page.locator(".plan-flow-actions .btn-generate-inline").click();
    });
    await sleep(400);
    return;
  }

  if (q.type === "text") {
    const skip = page.locator(".plan-flow-actions .convo-nav-btn").first();
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await sleep(350);
    return;
  }

  if (q.type === "loading") {
    await sleep(800);
    return;
  }

  const patch = applySimAnswer(q, answers);
  const val = patch[q.id];
  const label = uiLabelForValue(q, val);
  if (label) {
    if (Array.isArray(label)) {
      for (const l of label) await clickChoiceButton(page, l);
    } else {
      await clickChoiceButton(page, label);
    }
  }
}

async function skipScenicIfPresent(page) {
  const scenic = page.getByRole("button", { name: "Scenic route" });
  if (await scenic.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.locator(".plan-flow-actions .convo-nav-btn-skip").click();
    await sleep(350);
  }
}

async function runCase(browser, viewport, vehicleCase) {
  const caseKey = `${viewport.key}/${vehicleCase.key}`;
  const dir = path.join(OUT_ROOT, viewport.key, vehicleCase.key);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = {
    case: caseKey,
    vehicle: vehicleCase.key,
    viewport: viewport.key,
    screens: [],
    errors: [],
    googleMock: null,
  };
  const caseIssues = [];

  const contextOpts = { viewport: { width: viewport.width, height: viewport.height } };
  if (fs.existsSync(AUTH)) contextOpts.storageState = AUTH;
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  const googleMocks = await installGoogleApiMocks(page);

  try {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`);
    await sleep(1200);
    await closeProfileMenu(page);

    await screenshotScreen(page, dir, "hero-landing", "Hero landing", manifest, caseIssues, viewport.width < 768);

    await page.locator(".hero-input").first().waitFor({ timeout: 45_000 });
    await page.waitForFunction(() => window.google?.maps?.Map, { timeout: 90_000 });

    await fillHeroInput(page, 0, "Dallas, TX");
    await closeAutocomplete(page);
    await fillHeroInput(page, 1, "Houston, TX");
    await closeAutocomplete(page);
    await screenshotScreen(page, dir, "hero-route-filled", "Hero with route filled", manifest, caseIssues, viewport.width < 768);

    const goBtn = page.locator(".hero-go-btn");
    await goBtn.waitFor({ state: "visible", timeout: 90_000 });
    await page.waitForFunction(() => {
      const b = document.querySelector(".hero-go-btn");
      return b && !b.disabled;
    }, { timeout: 90_000 });
    await goBtn.click();
    await page.locator(".float-card--plan-flow").waitFor({ state: "visible", timeout: 45_000 });
    await sleep(500);
    await screenshotScreen(page, dir, "plan-vehicle", "Plan flow — vehicle step", manifest, caseIssues, viewport.width < 768);

    let answers = {};
    let steps = 0;
    const seenScreens = new Set();

    while (steps < 35) {
      steps++;
      const q = getNextFlowQuestion(answers, ROUTE_CONTEXT);
      if (q.done) break;

      if (q.pendingRoute && !isRouteContextReady(ROUTE_CONTEXT)) {
        const skipLink = page.locator(".question-skip-route-link");
        if (await skipLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
          await skipLink.click();
          await sleep(400);
        } else {
          answers = { ...answers, route_context_unavailable: true };
        }
        continue;
      }

      const title = await page.locator(".question-page-title").textContent().catch(() => "");
      const screenName = title?.trim() || q.ask || q.id || "question";
      const screenKey = `${q.id}:${screenName}`;

      if (!seenScreens.has(screenKey)) {
        seenScreens.add(screenKey);
        await screenshotScreen(page, dir, `q-${q.id}`, screenName, manifest, caseIssues, viewport.width < 768);
      }

      await answerQuestionInUI(page, q, answers, vehicleCase);
      await skipScenicIfPresent(page);

      const nextPatch = applySimAnswer(q, answers);
      answers = { ...answers, ...nextPatch };
      if (q.id === "vehicle") answers.vehicle = vehicleCase.value;

      await sleep(300);
    }

    const genBtn = page.locator(".btn-generate-trip").first();
    await genBtn.waitFor({ state: "visible", timeout: 20_000 });
    await screenshotScreen(page, dir, "generate-ready", "Generate trip ready", manifest, caseIssues, viewport.width < 768);

    if (STOP_AT !== "ready") {
      await genBtn.click();
      const overlay = page.locator(".generation-stream-overlay");
      await overlay.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      if (await overlay.isVisible().catch(() => false)) {
        await screenshotScreen(page, dir, "generation-overlay", "Generation overlay", manifest, caseIssues, viewport.width < 768);
      }

      await page.locator(".app-wrap.results-fullscreen, .trip-results-panel, .app-wrap.results-split-mode").first().waitFor({ state: "visible", timeout: 120_000 });
      await sleep(800);
      await screenshotScreen(page, dir, "results", "Results page", manifest, caseIssues, viewport.width < 768);
    }

    manifest.status = "ok";
  } catch (err) {
    manifest.status = "failed";
    manifest.errors.push(String(err.message || err));
    await page.screenshot({ path: path.join(dir, "ERROR-final.png"), fullPage: false }).catch(() => {});
    caseIssues.push({ screen: "Flow error", kind: "run-failure", detail: String(err.message || err).slice(0, 200) });
  } finally {
    manifest.googleMock = googleMocks.getStats();
    await context.close();
  }

  manifest.issues = caseIssues;
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function main() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const all = [];

  console.log(`Visual regression sweep → ${OUT_ROOT}`);
  console.log(`Base URL: ${BASE}\n`);

  for (const vp of VIEWPORTS) {
    for (const v of VEHICLES) {
      const label = `${vp.key}/${v.key}`;
      if (FILTER && !FILTER.has(label)) continue;
      process.stdout.write(`${label}… `);
      const result = await runCase(browser, vp, v);
      all.push(result);
      const gm = result.googleMock;
      const mockNote = gm ? ` [google mocked: ${gm.intercepted}]` : "";
      console.log(result.status === "ok" ? `ok${mockNote}` : `FAILED (${result.errors[0] || "unknown"})${mockNote}`);
    }
  }

  await browser.close();

  const reportIssues = [];
  for (const m of all) {
    for (const issue of m.issues || []) {
      reportIssues.push({
        vehicle: m.vehicle,
        viewport: m.viewport,
        screen: issue.screen,
        kind: issue.kind,
        detail: issue.detail || issue.text || issue.label || issue.selector || "",
      });
    }
  }

  fs.writeFileSync(path.join(OUT_ROOT, "sweep-results.json"), JSON.stringify({ cases: all, issues: reportIssues }, null, 2));
  console.log(`\nDone. ${all.filter(c => c.status === "ok").length}/${all.length} cases OK.`);

  const mockFailures = all.filter(m => (m.googleMock?.leaked?.length || 0) > 0);
  const noMocks = all.filter(m => (m.googleMock?.intercepted || 0) === 0);
  if (mockFailures.length > 0) {
    console.error("FAIL: Google mock handler errors:", mockFailures.map(m => m.case).join(", "));
    process.exit(2);
  }
  if (noMocks.length > 0) {
    console.error("FAIL: No Google requests intercepted:", noMocks.map(m => m.case).join(", "));
    process.exit(2);
  }

  process.exit(all.every(c => c.status === "ok") ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
