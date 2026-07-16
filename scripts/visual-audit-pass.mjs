/**
 * Full visual verification pass against localhost:4173.
 * Audit only — no app code changes.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "visual-audit-pass");
const EMAIL = "tripmappa@gmail.com";

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

function encodeSse(events) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function pickLabel(page, label) {
  const card = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: label }),
  }).first();
  if (await card.isVisible({ timeout: 2500 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const btn = page.getByRole("button", { name: new RegExp(`^${label}`, "i") }).first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}

async function waitAsk(page, re, timeout = 25000) {
  await page.waitForFunction(
    (pattern) => new RegExp(pattern, "i").test(document.body?.innerText || ""),
    re.source,
    { timeout },
  ).catch(() => null);
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".profile-card-trigger", { timeout: 45000 });
  await page.waitForTimeout(2000);

  await page.locator(".profile-card-trigger").click({ force: true });
  await page.waitForTimeout(400);
  if (await page.locator(".profile-card-signout").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    return true;
  }

  const menuSignIn = page.locator(".profile-card-nav-link", { hasText: /^Sign in$/i }).first();
  if (await menuSignIn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuSignIn.click({ force: true });
  } else {
    await page.keyboard.press("Escape");
    await page.locator(".profile-card-trigger").click({ force: true });
    await page.locator(".profile-card-nav-link", { hasText: /^Sign in$/i }).first().click({ force: true });
  }

  await page.locator("#signin-email").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.locator(".auth-modal-submit").click();
  await page.waitForTimeout(3000);
  const authError = await page.locator(".auth-modal-error").innerText().catch(() => null);
  if (authError) console.error("Sign-in error:", authError);
  await page.locator(".auth-modal-overlay").waitFor({ state: "hidden", timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(2500);

  await page.locator(".profile-card-trigger").click({ force: true });
  const ok = await page.locator(".profile-card-signout").isVisible({ timeout: 10000 }).catch(() => false);
  await page.keyboard.press("Escape");
  return ok;
}

async function signOut(page) {
  await page.locator(".profile-card-trigger").click();
  await page.locator(".profile-card-signout").click();
  await page.waitForTimeout(2000);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const env = loadEnvLocal();
  const email = EMAIL; // user-requested audit account
  const password = process.env.PLAYWRIGHT_ADMIN_PASSWORD
    || env.PLAYWRIGHT_ADMIN_PASSWORD
    || env.ADMIN_PASSWORD;

  if (!password) {
    console.error("Missing ADMIN_PASSWORD / PLAYWRIGHT_ADMIN_PASSWORD in .env.local");
    process.exit(1);
  }

  const report = { base: BASE, out: OUT, email, surfaces: {} };
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Seed a saved trip so returning dashboard + continue trips show
  await page.addInitScript(() => {
    const trip = {
      id: "audit-trip-fw-den",
      origin: "Fort Worth, TX, USA",
      dest: "Denver, CO, USA",
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      answers: { vehicle: "Car" },
      stops: [],
      roadStops: [],
      routeInfo: {
        distance: "780 mi",
        routePoints: [
          { lat: 32.75, lng: -97.33 },
          { lat: 39.74, lng: -104.99 },
        ],
      },
    };
    try {
      const existing = JSON.parse(localStorage.getItem("tripmappa-saved:v1") || "[]");
      if (!Array.isArray(existing) || existing.length === 0) {
        localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
      }
    } catch {
      localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
    }
  });

  const signedIn = await signIn(page, email, password);
  report.signedIn = signedIn;
  if (!signedIn) {
    await shot(page, "00-signin-failed.png");
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(1);
  }

  // —— 1. Returning dashboard ——
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForTimeout(2500);
  const returning = {
    greeting: await page.locator(".returning-user-greeting").innerText().catch(() => null),
    tagline: await page.locator(".returning-user-tagline").innerText().catch(() => null),
    planVisible: await page.locator(".returning-user-action--plan").isVisible().catch(() => false),
    navigateVisible: await page.locator(".returning-user-action--navigate").isVisible().catch(() => false),
    continueVisible: await page.locator(".returning-user-continue-trips").isVisible().catch(() => false),
    planH: (await page.locator(".returning-user-action--plan").boundingBox())?.height ?? null,
    continueH: (await page.locator(".returning-user-continue-trips").boundingBox())?.height ?? null,
    quickNav: await page.locator(".returning-user-quick-nav-label").innerText().catch(() => null),
    chips: await page.locator(".returning-user-chip").count(),
    highwayBg: await page.locator(".hero-highway-scene, .hero-bg, img").count(),
    sceneHtml: await page.locator(".returning-user-view").evaluate((el) => {
      const img = el.querySelector("img");
      const bg = getComputedStyle(el).backgroundImage;
      return {
        imgSrc: img?.currentSrc || img?.src || null,
        bg,
        classes: el.className,
      };
    }).catch(() => null),
  };
  returning.shot = await shot(page, "01-returning-dashboard.png");
  report.surfaces.returning = returning;

  // —— 2. Navigate ——
  await page.locator(".returning-user-action--navigate").click();
  await page.waitForSelector(".navigate-route-panel", { timeout: 20000 });
  await page.waitForTimeout(2000);
  const navigate = {
    fromLabels: await page.locator("label", { hasText: /^From$/i }).count(),
    whereSearch: await page.locator(".navigate-where-search, .search-bar-animated").count(),
    getRoute: await page.locator(".navigate-route-go").isVisible().catch(() => false),
    navigateHome: await page.locator(".navigate-home-map, button:has-text('Navigate Home')").count(),
    navigateHomeVisible: await page.locator(".navigate-home-map").isVisible().catch(() => false),
  };
  // Expand search
  const toggle = page.locator(".search-bar-animated-toggle").first();
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.waitForTimeout(500);
  navigate.placeholder = await page.locator(".search-bar-animated-input").getAttribute("placeholder").catch(() => null);
  navigate.shot = await shot(page, "02-navigate.png");
  // scroll/map bottom for Navigate Home
  navigate.shotBottom = await shot(page, "02b-navigate-bottom.png");
  report.surfaces.navigate = navigate;

  // —— 3. Settings ——
  await page.locator(".navigate-route-back").click().catch(() => null);
  await page.waitForTimeout(1000);
  // Ensure back on dashboard
  if (!(await page.locator(".returning-user-greeting").isVisible().catch(() => false))) {
    await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
    await page.waitForTimeout(2000);
  }
  await page.locator(".profile-card-trigger").click();
  await page.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  await page.locator(".profile-card-nav-link", { hasText: /^Settings$/ }).click();
  await page.waitForSelector(".settings-page", { timeout: 15000 });
  await page.waitForTimeout(800);
  const settings = {
    groups: await page.locator(".settings-hub-group-label").allTextContents(),
    bg: await page.evaluate(() => {
      const wrap = document.querySelector(".profile-view-wrap");
      const pageEl = document.querySelector(".settings-page");
      const cs = (el) => (el ? getComputedStyle(el).backgroundColor : null);
      return { wrap: cs(wrap), page: cs(pageEl) };
    }),
  };
  settings.shot = await shot(page, "03-settings.png");
  // scroll for billing
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  settings.shotBottom = await shot(page, "03b-settings-bottom.png");
  report.surfaces.settings = settings;

  // —— 4. Question flow ——
  await page.locator(".settings-page-back").click();
  await page.waitForTimeout(800);
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForTimeout(1500);
  await page.locator(".returning-user-action--plan, .hero-plan-cta").first().click();
  await page.waitForSelector(".float-card--plan-flow", { timeout: 45000 });
  await waitAsk(page, /Where are you headed/);
  await page.locator("#plan-route-origin").fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator("#plan-route-dest").fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".plan-flow-dock-continue, .btn-generate-inline").first().click();
  await waitAsk(page, /How are you traveling/);
  await pickLabel(page, "Car");
  await waitAsk(page, /run on|fuel|Gasoline/i);
  const fuelLabels = await page.locator(".plan-option-card-label, .plan-choice-row").allTextContents().catch(() => []);
  const fuelShot = await shot(page, "04a-fuel.png");
  await pickLabel(page, "Gasoline");
  await waitAsk(page, /towing|trailer/i);
  await pickLabel(page, "No");
  await waitAsk(page, /How many are joining/i);
  await pickLabel(page, "Just me");
  await waitAsk(page, /How often do you want to stop|stop/i);
  const stopTitle = await page.locator(".plan-flow-question-title").innerText().catch(() => "");
  const stopOptions = await page.locator(".plan-option-card-label").allTextContents().catch(() => []);
  const stopShot = await shot(page, "04b-stop-frequency.png");
  // pick moderate / first stop option
  if (stopOptions.length) await pickLabel(page, stopOptions[0].trim()) || await page.locator(".plan-option-card").first().click();
  await waitAsk(page, /budget level|luxury|hotel/i);
  const luxuryHasSlider = await page.locator(".plan-star-slider").isVisible().catch(() => false);
  const luxuryShot = await shot(page, "04c-luxury-stars.png");
  report.surfaces.questionFlow = {
    fuelLabels,
    fuelCount: fuelLabels.filter(Boolean).length,
    stopTitle,
    stopOptions,
    luxuryHasSlider,
    fuelShot,
    stopShot,
    luxuryShot,
  };

  // Finish enough of flow to generate for loader — continue with defaults when possible
  if (luxuryHasSlider) {
    await page.locator(".plan-star-slider-track").click({ position: { x: 100, y: 20 } }).catch(() => null);
    await page.waitForTimeout(400);
    // may auto-advance or need continue
    const dock = page.locator(".plan-flow-dock-continue").first();
    if (await dock.isVisible().catch(() => false)) await dock.click().catch(() => null);
  }

  // Advance remaining steps until ready/generate (bounded)
  for (let i = 0; i < 12; i++) {
    const title = await page.locator(".plan-flow-question-title").innerText().catch(() => "");
    const generate = page.locator(".btn-generate-trip").first();
    if (await generate.isVisible({ timeout: 800 }).catch(() => false)) break;
    if (/ready|generate/i.test(title) || /Generate My Trip/i.test(await page.innerText().catch(() => ""))) break;

    const cards = page.locator(".plan-option-card");
    if (await cards.count() > 0 && await cards.first().isVisible().catch(() => false)) {
      await cards.first().click();
      await page.waitForTimeout(500);
      continue;
    }
    if (await page.locator(".plan-star-slider").isVisible().catch(() => false)) {
      await page.locator(".plan-star-slider-track").click({ position: { x: 120, y: 20 } });
      await page.waitForTimeout(500);
      continue;
    }
    const cont = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
    if (await cont.isVisible().catch(() => false) && await cont.isEnabled().catch(() => false)) {
      await cont.click();
      await page.waitForTimeout(600);
      continue;
    }
    const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }

  // —— 7. Generation loader (mock SSE slow) ——
  await page.route("**/api/plan-trip", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await new Promise((r) => setTimeout(r, 2500));
    const body = encodeSse([
      { event: "start", data: { maxTokens: 4096, tier: "short" } },
      { event: "progress", data: { phase: "route", message: "Routing" } },
      { event: "progress", data: { phase: "stops", cityNames: ["Waco, TX"] } },
      {
        event: "complete",
        data: {
          route_summary: "Dallas to Austin",
          stops: [{ city: "Waco, TX", name: "Waco Stop", lat: 31.55, lng: -97.15 }],
          road_stops: [],
          tips: ["Enjoy the drive"],
        },
      },
    ]);
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
      body,
    });
  });

  const genBtn = page.locator(".btn-generate-trip").first();
  let loader = {
    generateVisible: await genBtn.isVisible().catch(() => false),
    wordmarkVisible: false,
    overlayVisible: false,
    centered: null,
  };
  if (loader.generateVisible) {
    await genBtn.click({ timeout: 5000 }).catch(async () => {
      await genBtn.evaluate((el) => el.click());
    });
    await page.waitForTimeout(600);
    loader.overlayVisible = await page.locator(".generation-stream-overlay").isVisible().catch(() => false);
    loader.wordmarkVisible = await page.locator(".pulsing-wordmark").first().isVisible().catch(() => false);
    loader.centered = await page.locator(".pulsing-wordmark").first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        className: el.className,
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        position: cs.position,
        transform: cs.transform,
        centerX: r.left + r.width / 2,
        centerY: r.top + r.height / 2,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      };
    }).catch(() => null);
    loader.shot = await shot(page, "07-generation-loader.png");
  } else {
    loader.shot = await shot(page, "07-generation-not-ready.png");
    loader.pageTextSnippet = (await page.locator(".plan-flow-question-title, .hero-title").first().innerText().catch(() => "")).slice(0, 120);
  }
  report.surfaces.generation = loader;

  // —— 5. Hero (sign out) ——
  await signOut(page);
  // Clear session welcome flag so fade can play
  await page.evaluate(() => {
    try { sessionStorage.removeItem("tm-hero-welcome-played"); } catch {}
  });
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForTimeout(400);
  const heroEarly = await shot(page, "05a-hero-early.png");
  await page.waitForTimeout(1600);
  const hero = {
    headline: await page.locator(".hero-welcome-headline, .hero-title").first().innerText().catch(() => null),
    valueLines: await page.locator(".hero-value-lines li").allTextContents().catch(() => []),
    cta: await page.locator(".hero-plan-cta").isVisible().catch(() => false),
    welcomeClass: await page.locator(".hero").first().getAttribute("class").catch(() => null),
    earlyShot: heroEarly,
    settledShot: await shot(page, "05b-hero-settled.png"),
  };
  report.surfaces.hero = hero;

  // —— 6. Profile menu (sign back in) ——
  const reSigned = await signIn(page, email, password);
  report.reSignedIn = reSigned;
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForTimeout(1500);
  await page.locator(".profile-card-trigger").click();
  await page.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  const menuText = await page.locator(".profile-card-dropdown.is-open").innerText();
  const menu = {
    text: menuText,
    hasMyTrips: /My trips/i.test(menuText),
    hasPlan: /Plan a new trip/i.test(menuText),
    hasProfile: /Profile/i.test(menuText),
    hasSettings: /Settings/i.test(menuText),
    hasBillingStandalone: /Subscription and billing/i.test(menuText),
    hasSupport: /Support & legal/i.test(menuText),
    hasSignOut: /Sign out/i.test(menuText),
    shot: await shot(page, "06-profile-menu.png"),
  };
  await page.locator(".profile-card-support-toggle").click().catch(() => null);
  await page.waitForTimeout(300);
  menu.supportOpenShot = await shot(page, "06b-profile-menu-support.png");
  report.surfaces.profileMenu = menu;

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
