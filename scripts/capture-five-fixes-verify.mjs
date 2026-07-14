/** Visual capture for the five UX fixes — day options, settings bleed, greeting, GPS denied, loader. */
import { chromium } from "playwright";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "five-fixes-verify");

const MOCK_TRIP = {
  id: "mock-trip-dallas-la",
  origin: "Dallas, TX, USA",
  dest: "Los Angeles, CA, USA",
  date: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  answers: { vehicle: "Car" },
  stops: [],
  roadStops: [],
  routeInfo: {
    distance: "1,440 mi",
    routePoints: [
      { lat: 32.78, lng: -96.8 },
      { lat: 34.05, lng: -118.24 },
    ],
  },
};

const PROFILE = {
  display_name: "Cade Warmke",
  home_address: "Fort Worth, TX, USA",
  onboarding_complete: true,
  tier: "wanderer",
};
const CREDITS = { tier: "wanderer", unlimited: false, remaining: 3, limit: 3, used: 0 };

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function pickLabel(page, label) {
  const card = page.locator(".plan-option-card:not(.is-disabled)").filter({
    has: page.locator(".plan-option-card-label", { hasText: label }),
  }).first();
  if (await card.isVisible({ timeout: 2500 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const btn = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") }).first();
  if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
    const disabled = await btn.isDisabled().catch(() => true);
    if (!disabled) {
      await btn.click();
      return true;
    }
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

async function authInit(page) {
  await page.addInitScript(({ trip, profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
    localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
  }, { trip: MOCK_TRIP, profile: PROFILE, credits: CREDITS });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = {};

  // 1) Day mode question flow options + star slider
  const flow = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await flow.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await flow.waitForSelector(".hero-plan-cta, .returning-user-action--plan, .hero-go-btn", { timeout: 30000 });
  const planCta = flow.locator(".hero-plan-cta, .returning-user-action--plan").first();
  if (await planCta.isVisible().catch(() => false)) {
    await planCta.click();
  } else {
    await flow.locator(".hero-input").first().fill("Dallas, TX");
    await closeAutocomplete(flow);
    await flow.locator(".hero-input").nth(1).fill("Austin, TX");
    await closeAutocomplete(flow);
    await flow.locator(".hero-go-btn").click();
  }
  await flow.waitForSelector(".float-card--plan-flow", { timeout: 45000 });
  if (await flow.locator("#plan-route-origin").isVisible().catch(() => false)) {
    await waitAsk(flow, /Where are you headed/);
    await flow.locator("#plan-route-origin").fill("Dallas, TX");
    await closeAutocomplete(flow);
    await flow.locator("#plan-route-dest").fill("Austin, TX");
    await closeAutocomplete(flow);
    await flow.locator(".plan-flow-dock-continue, .btn-generate-inline").first().click();
  }
  await waitAsk(flow, /How are you traveling/);
  await flow.waitForTimeout(600);
  await flow.screenshot({ path: path.join(OUT, "01-day-options-desktop.png"), fullPage: false });
  report.optionsTheme = await flow.evaluate(() => {
    const wrap = document.querySelector(".app-wrap");
    const card = document.querySelector(".plan-option-card");
    if (!card) return { theme: wrap?.className, card: null };
    const cs = getComputedStyle(card);
    const label = getComputedStyle(card.querySelector(".plan-option-card-label") || card);
    return {
      theme: wrap?.className,
      cardBg: cs.backgroundColor,
      cardBorder: cs.borderColor,
      labelColor: label.color,
    };
  });
  await pickLabel(flow, "Car");
  await waitAsk(flow, /run on|fuel|Gasoline/i);
  await pickLabel(flow, "Gasoline");
  await waitAsk(flow, /towing|trailer/i);
  await pickLabel(flow, "No");
  await waitAsk(flow, /How many are joining/i);
  await pickLabel(flow, "Just me");
  await waitAsk(flow, /How often do you want to stop/);
  await pickLabel(flow, "Moderate");
  await waitAsk(flow, /budget level for hotels/i);
  await flow.waitForSelector(".plan-star-slider", { timeout: 20000 });
  await flow.waitForTimeout(400);
  // Screenshot before clicking — answering can auto-advance to the next step
  await flow.screenshot({ path: path.join(OUT, "01b-day-star-slider-desktop.png"), fullPage: false });
  report.star = await flow.evaluate(() => {
    const filled = document.querySelector(".plan-star-slider-star.is-filled .plan-star-slider-glyph");
    const empty = document.querySelector(".plan-star-slider-star:not(.is-filled) .plan-star-slider-glyph");
    const any = document.querySelector(".plan-star-slider-glyph");
    return {
      filled: filled ? getComputedStyle(filled).color : null,
      emptyStroke: empty || any
        ? getComputedStyle(empty || any).webkitTextStrokeColor || getComputedStyle(empty || any).color
        : null,
      count: document.querySelectorAll(".plan-star-slider-star").length,
      ask: document.querySelector(".plan-flow-question-title, .ai-bubble, .question-page-title")?.textContent?.trim() || null,
    };
  });
  await flow.locator(".plan-star-slider-track").click({ position: { x: 180, y: 24 } });
  await flow.waitForTimeout(400);
  await flow.close();

  // 2) Settings full bleed
  const settings = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await authInit(settings);
  await settings.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await settings.waitForSelector(".returning-user-greeting, .profile-card-trigger", { timeout: 25000 });
  await settings.waitForTimeout(800);
  await settings.locator(".profile-card-trigger").click();
  await settings.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  await settings.locator(".profile-card-nav-link", { hasText: /^Settings$/ }).click();
  await settings.waitForSelector(".settings-page", { timeout: 15000 });
  await settings.waitForTimeout(600);
  report.settings = await settings.evaluate(() => {
    const wrap = document.querySelector(".app-wrap");
    const page = document.querySelector(".settings-page");
    const cs = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    return {
      wrapClass: wrap?.className,
      wrapBg: cs(wrap),
      pageBg: cs(page),
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  await settings.screenshot({ path: path.join(OUT, "02-settings-fullbleed-desktop.png"), fullPage: false });
  await settings.setViewportSize({ width: 375, height: 812 });
  await settings.waitForTimeout(300);
  await settings.screenshot({ path: path.join(OUT, "02-settings-fullbleed-mobile.png"), fullPage: false });
  await settings.close();

  // 3) Returning greeting with real name + initials
  const returning = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await authInit(returning);
  await returning.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await returning.waitForSelector(".returning-user-greeting", { timeout: 25000 });
  await returning.waitForTimeout(1000);
  report.greeting = await returning.locator(".returning-user-greeting").innerText().catch(() => null);
  report.avatarInitials = await returning.locator(".user-avatar, .nav-avatar, .profile-card-trigger").first().innerText().catch(() => null);
  // Try more specific avatar text
  const avatarText = await returning.evaluate(() => {
    const el = document.querySelector(".user-avatar-initials, .avatar-initials, .profile-card-avatar");
    return el?.textContent?.trim() || document.querySelector(".profile-card-trigger")?.textContent?.trim()?.slice(0, 4) || null;
  });
  report.avatarText = avatarText;
  await returning.screenshot({ path: path.join(OUT, "03-returning-greeting-desktop.png"), fullPage: false });
  await returning.setViewportSize({ width: 375, height: 812 });
  await returning.waitForTimeout(300);
  await returning.screenshot({ path: path.join(OUT, "03-returning-greeting-mobile.png"), fullPage: false });
  await returning.close();

  // 4) Navigate GPS denied
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    geolocation: undefined,
    permissions: [],
  });
  await context.setGeolocation({ latitude: 0, longitude: 0 }).catch(() => {});
  // Deny geolocation by not granting permission
  const nav = await context.newPage();
  await authInit(nav);
  await nav.addInitScript(() => {
    const deny = (success, error) => {
      if (typeof error === "function") {
        error({ code: 1, message: "User denied Geolocation", PERMISSION_DENIED: 1 });
      }
    };
    navigator.geolocation.getCurrentPosition = deny;
    navigator.geolocation.watchPosition = deny;
  });
  await nav.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await nav.waitForSelector(".returning-user-action--navigate", { timeout: 25000 });
  await nav.locator(".returning-user-action--navigate").click();
  await nav.waitForSelector(".navigate-route-panel", { timeout: 20000 });
  await nav.waitForSelector(".navigate-route-panel--manual-origin, #navigate-origin, .navigate-route-home-btn", { timeout: 15000 }).catch(() => null);
  await nav.waitForTimeout(1200);
  report.navigate = await nav.evaluate(() => ({
    hasFrom: Boolean(document.querySelector("#navigate-origin")),
    hasHomeBtn: Boolean(document.querySelector(".navigate-route-home-btn")),
    hint: document.querySelector(".navigate-route-location-hint")?.textContent?.trim() || null,
    panelClass: document.querySelector(".navigate-route-panel")?.className || null,
  }));
  await nav.screenshot({ path: path.join(OUT, "04-navigate-gps-denied-desktop.png"), fullPage: false });
  await nav.setViewportSize({ width: 375, height: 812 });
  await nav.waitForTimeout(300);
  await nav.screenshot({ path: path.join(OUT, "04-navigate-gps-denied-mobile.png"), fullPage: false });
  await context.close();

  // 5) Generation loader — live overlay with PulsingWordmark (mock via DOM after loading CSS from app)
  const loader = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await loader.goto(`${BASE}/`);
  await loader.waitForTimeout(800);
  const cssFiles = await readdir(path.join(process.cwd(), "dist", "assets"));
  const css = cssFiles.find((f) => f.startsWith("index-") && f.endsWith(".css"));
  await loader.evaluate(() => {
    document.body.innerHTML = "";
    document.body.style.margin = "0";
    document.body.style.minHeight = "100vh";
    const overlay = document.createElement("div");
    overlay.className = "generation-stream-overlay generation-stream-overlay--wordmark";
    overlay.setAttribute("aria-busy", "true");
    overlay.innerHTML = `
      <div class="pulsing-wordmark pulsing-wordmark--lg generation-pulsing-wordmark" role="status" aria-busy="true" aria-label="Loading">
        <span class="pulsing-wordmark-inner" aria-hidden="true">
          <span class="pulsing-wordmark-trip">Trip</span>
          <span class="pulsing-wordmark-mappa">Mappa</span>
        </span>
      </div>
      <p class="generation-loader-subtitle">Dallas → Austin</p>
      <p class="generation-loader-status">Mapping your stops…</p>
      <div class="generation-loader-progress-wrap" aria-hidden="true">
        <div class="generation-loader-progress-bar">
          <div class="generation-loader-progress-fill" style="width: 42%"></div>
        </div>
        <span class="generation-loader-progress-pct">42%</span>
      </div>
    `;
    document.body.appendChild(overlay);
  });
  report.loaderCss = css || null;
  report.loaderMarkup = await loader.evaluate(() => ({
    hasWordmark: Boolean(document.querySelector(".pulsing-wordmark")),
    hasCinematic: Boolean(document.querySelector(".generation-cinematic-loader, .cinematic-loader")),
    overlayClass: document.querySelector(".generation-stream-overlay")?.className || null,
  }));
  await loader.waitForTimeout(700);
  await loader.screenshot({ path: path.join(OUT, "05-generation-loader-desktop.png"), fullPage: false });
  await loader.setViewportSize({ width: 375, height: 812 });
  await loader.waitForTimeout(300);
  await loader.screenshot({ path: path.join(OUT, "05-generation-loader-mobile.png"), fullPage: false });
  await loader.close();

  await browser.close();
  console.log(JSON.stringify({ out: OUT, report }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
