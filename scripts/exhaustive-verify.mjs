/**
 * Exhaustive UI verification — 13 vehicles × 2 viewports.
 * Google Maps / Places / Geocoding / Directions calls are mocked (no live Google traffic).
 * TripMappa backend (/api/plan-trip, etc.) uses real server logic.
 *
 * Run: node scripts/exhaustive-verify.mjs
 * Requires: dev server on 5173, e2e/.auth/user.json
 *
 * Env:
 *   VERIFY_FILTER=desktop/Car,mobile/RV   — run subset only
 *   VERIFY_IGNORE_CHECKPOINT=1            — ignore checkpoint skips
 *   VERIFY_STOP_AT=ready                  — stop before Generate click
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";

const BASE = process.env.VERIFY_BASE_URL || "http://127.0.0.1:5173";
const SHOT = path.join(process.cwd(), "test-results", "exhaustive-verify");
const AUTH_STATE_PATH = path.join(process.cwd(), "e2e", ".auth", "user.json");
const CHECKPOINT_PATH = path.join(process.cwd(), "e2e", ".verify-checkpoint.json");
const VIEWPORTS = [{ n: "desktop", w: 1280, h: 800 }, { n: "mobile", w: 375, h: 812 }];
const VEHICLES = [
  { key: "Car", tab: "Personal", label: "Car", kind: "personal" },
  { key: "Motorcycle", tab: "Personal", label: "Motorcycle", kind: "personal" },
  { key: "SUV-Van", tab: "Personal", label: "SUV or Van", kind: "personal" },
  { key: "RV", tab: "Oversized", label: "RV", kind: "rv" },
  { key: "Camper-Van", tab: "Oversized", label: "Camper Van", kind: "rv" },
  { key: "Semi-Truck", tab: "Commercial", label: "Semi Truck 18-Wheeler", kind: "truck" },
  { key: "Flatbed", tab: "Commercial", label: "Flatbed", kind: "truck" },
  { key: "Tanker", tab: "Commercial", label: "Tanker", kind: "truck" },
  { key: "Box-Truck", tab: "Commercial", label: "Box Truck", kind: "truck" },
  { key: "Boat", tab: "Other", label: "Boat", kind: "thin" },
  { key: "Ferry", tab: "Other", label: "Ferry", kind: "thin" },
  { key: "Plane", tab: "Other", label: "Plane", kind: "thin" },
  { key: "Multi-Vehicle", tab: "More", label: "Multi-Vehicle Trip", kind: "multi" },
];

const FILTER = process.env.VERIFY_FILTER
  ? new Set(process.env.VERIFY_FILTER.split(",").map(s => s.trim()).filter(Boolean))
  : null;
const IGNORE_CHECKPOINT = process.env.VERIFY_IGNORE_CHECKPOINT === "1";
const STOP_AT = process.env.VERIFY_STOP_AT || "";

function caseId(vp, v) {
  return `${vp.n}/${v.key}`;
}

function emptyCheckpoint() {
  return {
    version: 2,
    completed: {},
    flags: [],
    consoleErrors: [],
    signedIn: false,
    authStorageLoaded: false,
    googleMockStats: [],
  };
}

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveCheckpoint(checkpoint) {
  fs.mkdirSync(path.dirname(CHECKPOINT_PATH), { recursive: true });
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
}

function ensureCheckpoint() {
  const existing = loadCheckpoint();
  if (existing) {
    existing.googleMockStats = existing.googleMockStats || [];
    existing.flags = existing.flags || [];
    existing.consoleErrors = existing.consoleErrors || [];
    existing.completed = existing.completed || {};
    return existing;
  }
  return emptyCheckpoint();
}

function checkpointToReport(checkpoint) {
  const vehicles = VIEWPORTS.flatMap(vp =>
    VEHICLES.map(v => checkpoint.completed[caseId(vp, v)]).filter(Boolean),
  );
  return {
    vehicles,
    authStoragePath: AUTH_STATE_PATH,
    authStorageLoaded: checkpoint.authStorageLoaded,
    flags: checkpoint.flags,
    consoleErrors: checkpoint.consoleErrors,
    signedIn: checkpoint.signedIn,
    googleMockStats: checkpoint.googleMockStats,
  };
}

async function shot(page, v, step, vp) {
  const d = path.join(SHOT, v, vp);
  fs.mkdirSync(d, { recursive: true });
  await page.screenshot({ path: path.join(d, `${step}.png`) });
}

async function verifyBtns(page, ctx) {
  return page.evaluate(({ ctx, vw, vh }) => {
    const out = [];
    for (const b of document.querySelectorAll("button:not([disabled])")) {
      const r = b.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const pe = getComputedStyle(b).pointerEvents;
      const text = (b.textContent || "").trim().slice(0, 36);
      const hit = document.elementFromPoint(cx, cy);
      if (pe === "none") out.push({ ctx, text, issue: "pointer-events-none" });
      else if (hit !== b && !b.contains(hit) && /Continue|Generate|Skip|Just me|Gasoline|^No$|Plan a Trip|Navigate/i.test(text)) {
        out.push({ ctx, text, issue: "elementFromPoint-miss", hit: hit?.className?.slice?.(0, 40) });
      }
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
        if (/Continue|Generate/i.test(text)) out.push({ ctx, text, issue: "off-viewport" });
      }
    }
    return out;
  }, { ctx, vw: page.viewportSize()?.width ?? 1280, vh: page.viewportSize()?.height ?? 800 });
}

async function closeProfileMenu(page) {
  const open = page.locator(".profile-card-dropdown.is-open");
  if (await open.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}

async function fillHeroInput(page, index, value) {
  const input = page.locator(".hero-input").nth(index);
  await input.click();
  await input.fill(value);
  await input.dispatchEvent("input");
  await input.dispatchEvent("change");
}

async function startFlow(page) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".hero-input", { timeout: 45_000 });
  await page.waitForFunction(() => window.google?.maps?.Map, { timeout: 90_000 });
  await fillHeroInput(page, 0, "Dallas, TX");
  await page.keyboard.press("Escape");
  await fillHeroInput(page, 1, "Houston, TX");
  await page.keyboard.press("Escape");
  await page.locator(".hero-go-btn").waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForFunction(() => {
    const b = document.querySelector(".hero-go-btn");
    return b && !b.disabled;
  }, { timeout: 90_000 });
  await page.locator(".hero-go-btn").click();
  await page.locator(".float-card--plan-flow").waitFor({ timeout: 45_000 });
}

async function pickVehicle(page, v) {
  await closeProfileMenu(page);
  if (v.tab) {
    await page.getByRole("tab", { name: v.tab, exact: true }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.getByRole("button", { name: v.label, exact: true }).click({ timeout: 8000 });
  const cont = page.locator(".plan-flow-actions .btn-generate-inline").first();
  if (await cont.isVisible().catch(() => false)) await cont.click();
}

async function advance(page, v) {
  const seq = {
    personal: ["Gasoline", "No", "Just me", "A few (2-3)", "Stop overnight along the way", "2 nights", "Mid-range hotel"],
    rv: ["Gasoline", "Just me", "A few (2-3)", "2 nights"],
    truck: ["General freight", "Yes — I sleep in the cab", "Love's", "No restrictions"],
    thin: ["Just me"],
    multi: [],
  }[v.kind] || [];

  for (let i = 0; i < 28; i++) {
    if (await page.locator(".app-wrap.results-split-mode, .app-wrap.results-fullscreen, .trip-results-panel").isVisible().catch(() => false)) {
      return "results";
    }
    if (await page.locator(".btn-generate-trip").isVisible().catch(() => false)) return "ready";

    if (v.kind === "multi" && i === 0) {
      await page.getByRole("button", { name: "Car", exact: true }).click().catch(() => {});
      await page.getByRole("button", { name: "RV", exact: true }).click().catch(() => {});
    } else if (v.kind === "multi" && i === 1) {
      await page.getByRole("button", { name: "Car", exact: true }).click().catch(() => {});
    } else {
      for (const n of seq) {
        const b = page.getByRole("button", { name: n, exact: true }).first();
        if (await b.isVisible().catch(() => false)) { await b.click(); break; }
      }
      await page.getByRole("button", { name: "Not sure / prefer not to say", exact: true }).click({ timeout: 300 }).catch(() => {});
      await page.getByRole("button", { name: "No restrictions", exact: true }).click({ timeout: 300 }).catch(() => {});
      await page.getByRole("button", { name: "No budget limit", exact: true }).click({ timeout: 300 }).catch(() => {});
    }

    const cont = page.locator(".plan-flow-actions .btn-generate-inline").first();
    if (await cont.isVisible().catch(() => false) && await cont.isEnabled().catch(() => false)) {
      const ask = await page.locator(".question-ask").textContent().catch(() => "");
      if (!/How are you traveling/i.test(ask || "")) await cont.click();
    }
    await page.locator(".convo-nav-btn-skip").first().click({ timeout: 400 }).catch(() => {});
    await page.waitForTimeout(200);
  }
  return "timeout";
}

async function isPageSignedIn(page) {
  const trigger = page.locator(".profile-card-trigger").first();
  if (!(await trigger.isVisible().catch(() => false))) return false;
  await trigger.click();
  const signedIn = await page.locator(".profile-card-signout").isVisible().catch(() => false);
  await page.keyboard.press("Escape");
  return signedIn;
}

async function runVehicle(browser, v, vp, checkpoint) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    storageState: AUTH_STATE_PATH,
  });
  const page = await ctx.newPage();
  const rec = { key: v.key, viewport: vp.n, btnIssues: [], flow: null, results: false, googleMock: null };
  const errs = [];

  const googleMocks = await installGoogleApiMocks(page);
  page.removeAllListeners("console");
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });

  await startFlow(page);
  checkpoint.authStorageLoaded = true;
  checkpoint.signedIn = checkpoint.signedIn || await isPageSignedIn(page);
  await shot(page, v.key, "01-plan", vp.n);
  rec.btnIssues.push(...await verifyBtns(page, `${v.key}/plan`));
  await pickVehicle(page, v);
  await shot(page, v.key, "02-vehicle", vp.n);
  rec.flow = await advance(page, v);
  await shot(page, v.key, `03-${rec.flow}`, vp.n);
  rec.btnIssues.push(...await verifyBtns(page, `${v.key}/flow`));

  if (rec.flow === "ready" && STOP_AT !== "ready") {
    const gen = page.locator(".btn-generate-trip").first();
    if (await gen.isEnabled().catch(() => false)) {
      await gen.click();
      rec.results = await page.locator(".app-wrap.results-split-mode, .app-wrap.results-fullscreen, .trip-results-panel")
        .first()
        .waitFor({ timeout: 120_000 })
        .then(() => true)
        .catch(() => false);
      if (rec.results) await shot(page, v.key, "04-results", vp.n);
    } else {
      checkpoint.flags.push({ vehicle: v.key, viewport: vp.n, issue: "generate-disabled-or-unsigned" });
    }
  }

  if (rec.flow === "timeout") {
    checkpoint.flags.push({ vehicle: v.key, viewport: vp.n, issue: "flow-timeout-before-generate" });
  }
  if (errs.length) {
    checkpoint.consoleErrors.push({ vehicle: v.key, viewport: vp.n, errs: [...new Set(errs)].slice(0, 5) });
  }

  rec.googleMock = googleMocks.getStats();
  checkpoint.googleMockStats.push({ case: caseId(vp, v), ...rec.googleMock });

  if (rec.googleMock.leaked?.length > 0) {
    checkpoint.flags.push({
      vehicle: v.key,
      viewport: vp.n,
      issue: "google-mock-error",
      detail: rec.googleMock.leaked,
    });
  }

  checkpoint.completed[caseId(vp, v)] = rec;
  saveCheckpoint(checkpoint);
  await ctx.close();
  return rec;
}

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) rmrf(f);
    else fs.unlinkSync(f);
  }
  fs.rmdirSync(p);
}

function printSummary(report, checkpoint) {
  const total = VIEWPORTS.length * VEHICLES.length;
  const completed = report.vehicles.length;
  const ready = report.vehicles.filter(v =>
    v.flow === "ready" || v.flow === "results" || v.results === true,
  ).length;
  const withResults = report.vehicles.filter(v => v.results === true).length;
  const btnIssues = report.vehicles.reduce((n, v) => n + (v.btnIssues?.length || 0), 0);
  const googleIntercepted = (report.googleMockStats || []).reduce((n, s) => n + (s.intercepted || 0), 0);
  const mockErrors = (report.googleMockStats || []).filter(s => (s.leaked?.length || 0) > 0).length;

  console.log(`\nSUMMARY: ${ready}/${total} reached generate/results (${withResults} with results page), ${btnIssues} button issues, signedIn=${report.signedIn}`);
  console.log(`GOOGLE MOCKS: ${googleIntercepted} requests intercepted (${mockErrors} mock errors)`);
  console.log(`CHECKPOINT: ${completed}/${total} cases recorded`);
  if (completed >= total) console.log("All cases complete.");
}

async function main() {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    console.error(
      `Missing Playwright auth storage at ${AUTH_STATE_PATH}\n`
      + "Run: node scripts/export-playwright-auth.mjs (with dev server on port 5173)",
    );
    process.exit(1);
  }

  const checkpoint = ensureCheckpoint();
  const alreadyDone = Object.keys(checkpoint.completed).length;
  console.log(`Checkpoint loaded: ${alreadyDone} case(s) already complete → ${CHECKPOINT_PATH}`);
  if (IGNORE_CHECKPOINT) console.log("VERIFY_IGNORE_CHECKPOINT=1 — re-running filtered cases");

  fs.mkdirSync(SHOT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let ran = 0;

  for (const vp of VIEWPORTS) {
    for (const v of VEHICLES) {
      const id = caseId(vp, v);
      if (FILTER && !FILTER.has(id)) continue;
      if (!IGNORE_CHECKPOINT && checkpoint.completed[id] && !FILTER) {
        console.log(`${id} (skipped — checkpoint)`);
        continue;
      }
      console.log(id);
      await runVehicle(browser, v, vp, checkpoint);
      ran += 1;
    }
  }

  await browser.close();
  rmrf(SHOT);
  try { fs.rmdirSync(SHOT); } catch { /* */ }

  const report = checkpointToReport(checkpoint);
  console.log(JSON.stringify(report, null, 2));
  printSummary(report, checkpoint);

  if (ran === 0 && !FILTER) {
    console.log("Nothing to run — all cases were already in the checkpoint.");
  }

  const mockFailures = (report.googleMockStats || []).filter(s => (s.leaked?.length || 0) > 0);
  const noMocks = (report.googleMockStats || []).filter(s => (s.intercepted || 0) === 0);
  if (mockFailures.length > 0) {
    console.error("FAIL: Google mock handler errors:", mockFailures.map(l => l.case).join(", "));
    process.exit(2);
  }
  if (noMocks.length > 0 && ran > 0) {
    console.error("FAIL: No Google requests intercepted (mocks may not be active):", noMocks.map(l => l.case).join(", "));
    process.exit(2);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
