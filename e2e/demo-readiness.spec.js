import fs from "fs";
import path from "path";
import { expect, test } from "@playwright/test";
import {
  clickGenerate,
  closeAutocomplete,
  finishTripDetails,
  pickPlanOption,
  reachTripDetailsStep,
  skipOptionalSteps,
  waitPlanStepReady,
} from "./helpers/planFlowHelpers.js";

const PRODUCTION_URL = "https://tripmappa.com";
const DEFAULT_ADMIN_EMAIL = "tripmappa@gmail.com";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const ORANGE_GRADIENT_RE = /#(?:ff8c42|ffd28c|c87010)/i;
const PURPLE_RE = /#(?:a855f7|7c3aed|9333ea|8b5cf6|6d28d9)|purple|violet|rebeccapurple/i;

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function logCheck(label, pass, actual) {
  console.log(`${pass ? "PASS" : "FAIL"} | ${label} | ${actual}`);
}

function isPurpleHeroAccent(styles) {
  const bg = String(styles.backgroundImage || "");
  const color = String(styles.color || "");
  if (PURPLE_RE.test(bg) || PURPLE_RE.test(color)) return true;
  if (ORANGE_GRADIENT_RE.test(bg)) return false;
  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgb) return false;
  const r = Number(rgb[1]);
  const g = Number(rgb[2]);
  const b = Number(rgb[3]);
  return b > 140 && r > 90 && g < 130;
}

/** Close confirm dialogs, draft resume banners, and other overlays that block plan-flow clicks. */
async function dismissBlockingOverlays(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let dismissed = false;

    const confirmOverlay = page.locator(".confirm-dialog-overlay");
    if (await confirmOverlay.isVisible({ timeout: 400 }).catch(() => false)) {
      const cancel = confirmOverlay.locator(".confirm-dialog-cancel").first();
      if (await cancel.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await cancel.click({ timeout: 5_000 });
        await expect(confirmOverlay).toHaveCount(0, { timeout: 8_000 }).catch(() => {});
        dismissed = true;
        await page.waitForTimeout(300);
      }
    }

    const draftDismiss = page.locator(".hero-draft-resume-dismiss");
    if (await draftDismiss.isVisible({ timeout: 400 }).catch(() => false)) {
      await draftDismiss.click({ timeout: 5_000 });
      dismissed = true;
      await page.waitForTimeout(300);
    }

    const authOverlay = page.locator(".auth-modal-overlay");
    if (await authOverlay.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press("Escape");
      dismissed = true;
      await page.waitForTimeout(300);
    }

    const mapInfoClose = page.locator(".map-info-card.is-open .map-info-close").first();
    if (await mapInfoClose.isVisible({ timeout: 400 }).catch(() => false)) {
      await mapInfoClose.click({ timeout: 3_000 }).catch(() => {});
      dismissed = true;
      await page.waitForTimeout(200);
    }

    if (!dismissed) break;
  }
}

async function confirmStartOverDialog(page) {
  const confirmOverlay = page.locator(".confirm-dialog-overlay");
  if (await confirmOverlay.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const confirmBtn = confirmOverlay.locator(".confirm-dialog-confirm").first();
    await confirmBtn.click({ timeout: 5_000 });
    await expect(confirmOverlay).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(400);
  }
}

async function signInAsAdmin(page, email, password) {
  await page.goto(`${PRODUCTION_URL}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const trigger = page.locator(".profile-card-trigger").first();
  await trigger.waitFor({ state: "visible", timeout: 45_000 });
  await trigger.click();

  const signedIn = await page.locator(".profile-card-signout").isVisible({ timeout: 2_000 }).catch(() => false);
  if (signedIn) {
    await page.keyboard.press("Escape");
    return;
  }

  await page.getByRole("button", { name: "Sign In", exact: true }).click({ timeout: 10_000 });
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();

  await expect(page.locator(".auth-modal")).toHaveCount(0, { timeout: 45_000 });
  await trigger.click();
  await expect(page.locator(".profile-card-signout")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await dismissBlockingOverlays(page);
}

async function startDemoPlanFlow(page) {
  await page.goto(`${PRODUCTION_URL}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await dismissBlockingOverlays(page);

  const editTrip = page.getByRole("button", { name: /Edit trip/i });
  if (await editTrip.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.getByRole("button", { name: /TripMappa home/i }).click().catch(() => {});
    await page.waitForTimeout(800);
    await dismissBlockingOverlays(page);
  }

  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  const goBtn = page.locator(".hero-go-btn");
  await expect(goBtn).toBeEnabled({ timeout: 90_000 });
  await dismissBlockingOverlays(page);
  await goBtn.click();
  await expect(page.locator(".float-card--plan-flow")).toBeVisible({ timeout: 45_000 });

  const startOver = page.locator(".plan-flow-dock-start-over, .plan-flow-start-over").first();
  if (await startOver.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await startOver.click();
    await confirmStartOverDialog(page);
  }
  await dismissBlockingOverlays(page);
}

async function completeDemoCarFlow(page) {
  await dismissBlockingOverlays(page);
  await pickPlanOption(page, "Car");
  await waitPlanStepReady(page);
  await dismissBlockingOverlays(page);

  await pickPlanOption(page, "Gasoline");
  await waitPlanStepReady(page);
  await dismissBlockingOverlays(page);

  const towingNo = page.locator(".plan-option-card-label", { hasText: /^No$/ }).first();
  if (await towingNo.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await pickPlanOption(page, "No");
    await waitPlanStepReady(page);
    await dismissBlockingOverlays(page);
  }

  await pickPlanOption(page, "Just me");
  await waitPlanStepReady(page);
  await dismissBlockingOverlays(page);

  await pickPlanOption(page, "Just one stop");
  await waitPlanStepReady(page);
  await dismissBlockingOverlays(page);

  await skipOptionalSteps(page);
  await dismissBlockingOverlays(page);

  const tripDetails = page.locator(".question-page-title, .plan-flow-question-title").filter({ hasText: "A few more details" });
  const generateReady = page.locator(".btn-generate-trip");
  if (await tripDetails.isVisible({ timeout: 8_000 }).catch(() => false)) {
    const skipDefaults = page.getByRole("button", { name: /Skip for now|Use defaults|Defaults are fine/i });
    if (await skipDefaults.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dismissBlockingOverlays(page);
      await skipDefaults.first().click();
      await page.waitForTimeout(400);
    }
    await dismissBlockingOverlays(page);
    await finishTripDetails(page);
    return;
  }

  if (await generateReady.isVisible({ timeout: 5_000 }).catch(() => false)) {
    return;
  }

  await reachTripDetailsStep(page);
  await dismissBlockingOverlays(page);
  const skipDefaults = page.getByRole("button", { name: /Skip for now|Use defaults|Defaults are fine/i });
  if (await skipDefaults.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skipDefaults.first().click();
    await page.waitForTimeout(400);
  }
  await dismissBlockingOverlays(page);
  await finishTripDetails(page);
}

async function waitForProductionGeneration(page) {
  await expect(page.locator(".plan-generation-error")).toHaveCount(0, { timeout: 30_000 });
  await expect(
    page.locator(".app-wrap.results-fullscreen, .app-wrap.map-fullscreen-mode, .trip-results-split").first(),
  ).toBeVisible({ timeout: 240_000 });
  await expect(page.locator(".generation-stream-overlay")).toHaveCount(0, { timeout: 30_000 });
}

async function openMapFromResults(page) {
  const viewMap = page.locator(".trip-results-map-btn").first();
  if (await viewMap.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await viewMap.click();
  } else {
    await page.getByRole("button", { name: /Start navigation/i }).first().click();
  }
  await expect(page.locator(".gmap-wrap")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2500);
}

async function clickFirstMapMarker(page, preferredName = "") {
  const mapRegion = page.getByRole("region", { name: "Map" });
  const controlPattern = /^(Map style|Zoom in|Zoom out|Recenter|Back to Trip|Edit plan|Google|Terms|Map camera)/i;

  if (preferredName) {
    const tokens = preferredName.split(/\s+/).filter((t) => t.length > 3);
    for (const token of tokens.slice(0, 3)) {
      const named = mapRegion.getByRole("button", { name: new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
      if (await named.count() > 0) {
        await named.first().click({ timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(1000);
        const popupVisible = await page.locator(
          ".neon-sign-popup-business-name, .map-info-card.is-open, .map-info-card-sr-title",
        ).first().isVisible().catch(() => false);
        if (popupVisible) {
          return { clicked: true, label: preferredName, strategy: "named-stop" };
        }
      }
    }
  }

  const markerButtons = mapRegion.getByRole("button");
  const markerCount = await markerButtons.count();
  for (let i = 0; i < markerCount; i += 1) {
    const btn = markerButtons.nth(i);
    const label = ((await btn.getAttribute("aria-label")) || (await btn.textContent()) || "").trim();
    if (!label || controlPattern.test(label) || /^Austin, TX$/i.test(label)) continue;
    await btn.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const popupVisible = await page.locator(
      ".neon-sign-popup-business-name, .map-info-card.is-open, .map-info-card-sr-title",
    ).first().isVisible().catch(() => false);
    if (popupVisible) {
      return { clicked: true, label, strategy: "map-button" };
    }
  }

  const markerMeta = await page.evaluate(() => {
    const wrap = document.querySelector(".gmap-wrap");
    if (!wrap) return { clicked: false, reason: "missing .gmap-wrap" };

    const candidates = [...wrap.querySelectorAll("img, [role='button']")].filter((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 12 || rect.height < 12) return false;
      if (rect.width > 120 || rect.height > 120) return false;
      const src = el.getAttribute("src") || "";
      if (/logo|legend|control|transparent/i.test(src)) return false;
      return true;
    });

    for (const el of candidates) {
      const target = el.closest("[role='button']") || el;
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      return {
        clicked: true,
        label: target.getAttribute("aria-label") || target.getAttribute("title") || el.getAttribute("alt") || "marker",
      };
    }

    return { clicked: false, reason: `no marker candidates (${candidates.length})` };
  });

  if (!markerMeta.clicked) {
    const box = await page.locator(".gmap-wrap").boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
      return { clicked: true, label: "map coordinate click" };
    }
  }

  return markerMeta;
}

async function navigateToHeroFromPlan(page) {
  const homeBtn = page.getByRole("button", { name: /TripMappa home/i });
  if (await homeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await homeBtn.click();
  } else {
    await page.goto(`${PRODUCTION_URL}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(1200);
}

test.describe.configure({ mode: "serial", timeout: 600_000 });

test("demo readiness sweep on production", async ({ page, context }) => {
  const envLocal = loadEnvLocal();
  const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL
    || envLocal.PLAYWRIGHT_ADMIN_EMAIL
    || DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD
    || envLocal.PLAYWRIGHT_ADMIN_PASSWORD
    || process.env.ADMIN_PASSWORD
    || envLocal.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      "PLAYWRIGHT_ADMIN_PASSWORD is required to run the production demo readiness test.",
    );
  }

  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: PRODUCTION_URL });

  const checks = [];

  console.log(`\n=== TripMappa demo readiness @ ${PRODUCTION_URL} ===`);
  console.log(`Admin account: ${adminEmail}\n`);

  await signInAsAdmin(page, adminEmail, adminPassword);
  await startDemoPlanFlow(page);
  await completeDemoCarFlow(page);
  await dismissBlockingOverlays(page);
  await clickGenerate(page);
  await waitForProductionGeneration(page);

  // 1) Results page + stop cards
  const stopCards = page.locator(".road-trip-stop-card, .road-stop-card");
  const stopCount = await stopCards.count();
  const firstStopName = stopCount > 0
    ? (await stopCards.first().locator(".road-trip-stop-card-name, .road-stop-card-name").first().textContent())?.trim()
    : "";
  const resultsVisible = await page.locator(".app-wrap.results-fullscreen, .trip-results-split").first().isVisible();
  const check1Pass = resultsVisible && stopCount >= 1;
  const check1Actual = `resultsVisible=${resultsVisible}, stopCardCount=${stopCount}, firstStop="${firstStopName || "none"}"`;
  logCheck("results page with stop cards", check1Pass, check1Actual);
  checks.push(check1Pass);

  // 2) Map container fills parent (no small tile)
  await dismissBlockingOverlays(page);
  await openMapFromResults(page);
  const mapDims = await page.evaluate(() => {
    const map = document.querySelector(".gmap-wrap");
    const parent = map?.closest(".map-full, .trip-map-fullscreen, .trip-results-split-map") || map?.parentElement;
    if (!map || !parent) return null;
    const m = map.getBoundingClientRect();
    const p = parent.getBoundingClientRect();
    return {
      mapW: Math.round(m.width),
      mapH: Math.round(m.height),
      parentW: Math.round(p.width),
      parentH: Math.round(p.height),
      widthRatio: m.width / Math.max(p.width, 1),
      heightRatio: m.height / Math.max(p.height, 1),
    };
  });
  const check2Pass = Boolean(
    mapDims
    && mapDims.mapW >= 240
    && mapDims.mapH >= 240
    && mapDims.widthRatio >= 0.88
    && mapDims.heightRatio >= 0.88,
  );
  const check2Actual = mapDims
    ? `map=${mapDims.mapW}x${mapDims.mapH}, parent=${mapDims.parentW}x${mapDims.parentH}, ratios=${mapDims.widthRatio.toFixed(2)}x${mapDims.heightRatio.toFixed(2)}`
    : "map dimensions unavailable";
  logCheck("map container fills parent", check2Pass, check2Actual);
  checks.push(check2Pass);

  // 3) Map marker opens popup with business name
  const markerClick = await clickFirstMapMarker(page, firstStopName);
  await page.waitForTimeout(1200);
  const popupName = page.locator(".neon-sign-popup-business-name, .map-info-card-sr-title, #map-info-card-title").first();
  const popupVisible = await popupName.isVisible({ timeout: 10_000 }).catch(() => false);
  let businessName = popupVisible ? (await popupName.textContent())?.trim() : "";
  if (!businessName) {
    businessName = (await page.locator(".neon-sign-popup-business-name").textContent().catch(() => ""))?.trim() || "";
  }
  const check3Pass = popupVisible && Boolean(businessName);
  const check3Actual = `markerClick=${JSON.stringify(markerClick)}, businessName="${businessName || "none"}"`;
  logCheck("map marker popup shows business name", check3Pass, check3Actual);
  checks.push(check3Pass);

  // Back to itinerary before share / hero checks
  const backToTrip = page.getByRole("button", { name: /Back to Trip/i });
  if (await backToTrip.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await backToTrip.click();
    await expect(page.locator(".app-wrap.results-fullscreen")).toBeVisible({ timeout: 20_000 });
  }

  // 5) Share button yields server URL with UUID (not localStorage-only)
  const localShareKeysBefore = await page.evaluate(() => (
    Object.keys(localStorage).filter((k) => k.startsWith("tripmappa-share-")).length
  ));

  const shareResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/itinerary-share") && res.request().method() === "POST",
    { timeout: 45_000 },
  );

  const shareBtn = page.getByRole("button", { name: /Share trip/i });
  const shareBtnVisible = await shareBtn.isVisible({ timeout: 8_000 }).catch(() => false);
  let shareUrl = "";
  let shareSource = "unavailable";
  let apiStatus = null;

  if (shareBtnVisible) {
    await dismissBlockingOverlays(page);
    await shareBtn.click();
    const shareResponse = await shareResponsePromise.catch(() => null);
    if (shareResponse) {
      apiStatus = shareResponse.status();
      const payload = await shareResponse.json().catch(() => ({}));
      shareUrl = payload.shareUrl || "";
      shareSource = "api";
    } else {
      await page.waitForTimeout(1500);
      shareUrl = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return "";
        }
      });
      shareSource = "clipboard";
    }
  }

  const localShareKeysAfter = await page.evaluate(() => (
    Object.keys(localStorage).filter((k) => k.startsWith("tripmappa-share-")).length
  ));
  const localOnly = apiStatus !== 200 && localShareKeysAfter > localShareKeysBefore;
  const uuidInUrl = UUID_RE.test(shareUrl);
  const check5Pass = shareBtnVisible && uuidInUrl && !localOnly;
  const check5Actual = `shareButtonVisible=${shareBtnVisible}, source=${shareSource}, apiStatus=${apiStatus}, url="${shareUrl || "empty"}", localShareKeysBefore=${localShareKeysBefore}, localShareKeysAfter=${localShareKeysAfter}, localOnly=${localOnly}`;

  await page.getByRole("button", { name: /Edit/i }).first().click();
  await navigateToHeroFromPlan(page);

  const heroAccent = page.locator(".hero-title-accent");
  const heroVisible = await heroAccent.isVisible({ timeout: 20_000 }).catch(() => false);
  let check4Pass = false;
  let check4Actual = `heroVisible=${heroVisible}`;
  if (heroVisible) {
    const heroStyles = await heroAccent.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        color: cs.color,
        backgroundImage: cs.backgroundImage,
        webkitTextFillColor: cs.webkitTextFillColor,
      };
    });
    const heroPurple = isPurpleHeroAccent(heroStyles);
    check4Pass = !heroPurple;
    check4Actual = `color=${heroStyles.color}, backgroundImage=${heroStyles.backgroundImage}, webkitTextFillColor=${heroStyles.webkitTextFillColor}`;
  }

  logCheck("hero headline accent not purple after navigating back", check4Pass, check4Actual);
  checks.push(check4Pass);
  logCheck("share URL contains UUID (not localStorage-only)", check5Pass, check5Actual);
  checks.push(check5Pass);

  const passed = checks.filter(Boolean).length;
  const total = checks.length;
  const score = Math.round((passed / total) * 100);
  console.log(`\n=== Demo readiness score: ${passed}/${total} (${score}%) ===\n`);

  expect(
    checks.every(Boolean),
    `Demo readiness failed: ${passed}/${total} checks passed (${score}%)`,
  ).toBeTruthy();
});
