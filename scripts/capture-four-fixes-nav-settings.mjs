import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "four-fixes-nav-settings");

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

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Hero
  const hero = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await hero.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await hero.waitForSelector(".hero-welcome-headline, .hero-title", { timeout: 25000 });
  await hero.waitForTimeout(1800);
  const valueLines = await hero.locator(".hero-value-lines li").allTextContents().catch(() => []);
  await hero.screenshot({ path: path.join(OUT, "01-hero.png"), fullPage: false });
  await hero.close();

  // Returning + Continue trips hierarchy
  const returning = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await returning.addInitScript(({ trip, profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
    localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
  }, { trip: MOCK_TRIP, profile: PROFILE, credits: CREDITS });
  await returning.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await returning.waitForSelector(".returning-user-continue-trips", { timeout: 25000 });
  await returning.waitForTimeout(1000);
  const continueBox = await returning.locator(".returning-user-continue-trips").boundingBox();
  const planBox = await returning.locator(".returning-user-action--plan").boundingBox();
  await returning.screenshot({ path: path.join(OUT, "02-returning.png"), fullPage: false });

  // Navigate panel
  await returning.locator(".returning-user-action--navigate").click();
  await returning.waitForSelector(".navigate-route-panel", { timeout: 20000 });
  await returning.waitForTimeout(1500);
  const hasFrom = await returning.locator("label", { hasText: /^From$/i }).count();
  const whereSearch = await returning.locator(".navigate-where-search").count();
  await returning.locator(".search-bar-animated-toggle").first().click().catch(() => null);
  await returning.waitForTimeout(500);
  await returning.screenshot({ path: path.join(OUT, "03-navigate.png"), fullPage: false });

  // Settings
  await returning.locator(".profile-card-trigger").click();
  await returning.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  await returning.locator(".profile-card-nav-link", { hasText: /^Settings$/ }).click();
  await returning.waitForSelector(".settings-page", { timeout: 15000 });
  await returning.waitForTimeout(800);
  const groups = await returning.locator(".settings-hub-group-label").allTextContents();
  const bg = await returning.evaluate(() => {
    const wrap = document.querySelector(".profile-view-wrap");
    const page = document.querySelector(".settings-page");
    const cs = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    return { wrap: cs(wrap), page: cs(page) };
  });
  await returning.screenshot({ path: path.join(OUT, "04-settings.png"), fullPage: false });
  await returning.close();

  console.log(JSON.stringify({
    out: OUT,
    valueLines,
    continueHeight: continueBox?.height,
    planHeight: planBox?.height,
    hasFrom,
    whereSearch,
    groups,
    bg,
  }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
