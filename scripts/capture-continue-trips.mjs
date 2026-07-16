import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "continue-trips");

const MOCK_TRIP = {
  id: "mock-trip-dallas-la",
  origin: "Dallas, TX, USA",
  dest: "Los Angeles, CA, USA",
  date: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  answers: { vehicle: "RV", fuel_type: "Gasoline", travelers: "2" },
  stops: [
    { city: "El Paso, TX", name: "Franklin Mountains", lat: 31.79, lng: -106.42 },
    { city: "Phoenix, AZ", name: "Desert Botanical", lat: 33.46, lng: -111.94 },
  ],
  roadStops: [],
  routeInfo: {
    distance: "1,440 mi",
    duration: "20 hours",
    routePoints: [
      { lat: 32.78, lng: -96.8 },
      { lat: 31.79, lng: -106.42 },
      { lat: 33.46, lng: -111.94 },
      { lat: 34.05, lng: -118.24 },
    ],
  },
};

const MOCK_TRIP_2 = {
  id: "mock-trip-austin-sa",
  origin: "Austin, TX, USA",
  dest: "Santa Fe, NM, USA",
  date: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  answers: { vehicle: "Car", fuel_type: "Gasoline", travelers: "Just me" },
  stops: [{ city: "Lubbock, TX", lat: 33.58, lng: -101.86 }],
  roadStops: [],
  routeInfo: {
    distance: "680 mi",
    duration: "10 hours",
    routePoints: [
      { lat: 30.27, lng: -97.74 },
      { lat: 33.58, lng: -101.86 },
      { lat: 35.69, lng: -105.94 },
    ],
  },
};

const MOCK_DRAFT = {
  origin: "Fort Worth, TX, USA",
  dest: "Denver, CO, USA",
  answers: { vehicle: "Car" },
  questionHistory: [],
  convoComplete: false,
  savedAt: Date.now(),
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

  // Returning dashboard with Continue trips
  const returning = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await returning.addInitScript(({ trip, trip2, draft, profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
    localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip, trip2]));
    localStorage.setItem("tripmappa-plan-draft:v1", JSON.stringify(draft));
  }, { trip: MOCK_TRIP, trip2: MOCK_TRIP_2, draft: MOCK_DRAFT, profile: PROFILE, credits: CREDITS });
  await returning.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await returning.waitForSelector(".returning-user-continue-trips", { timeout: 25000 });
  await returning.waitForTimeout(1200);
  const greeting = await returning.locator(".returning-user-greeting").innerText().catch(() => "");
  const eyebrowCount = await returning.locator(".returning-user-eyebrow").count();
  const tagline = await returning.locator(".returning-user-tagline").innerText().catch(() => "");
  await returning.screenshot({ path: path.join(OUT, "01-returning-continue-trips.png"), fullPage: false });

  await returning.locator(".returning-user-continue-trips").click();
  await returning.waitForSelector(".trips-panel", { timeout: 15000 });
  await returning.waitForTimeout(800);
  const draftBadge = await returning.locator(".trips-saved-card-badge").first().innerText().catch(() => "");
  const cardCount = await returning.locator(".trips-saved-card").count();
  await returning.screenshot({ path: path.join(OUT, "02-trips-panel.png"), fullPage: false });
  await returning.close();

  // Hero (new user / signed out)
  const hero = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await hero.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await hero.waitForSelector(".hero-welcome-headline, .hero-title", { timeout: 25000 });
  await hero.waitForTimeout(1400);
  const heroHeadline = await hero.locator(".hero-welcome-headline, .hero-title").first().innerText().catch(() => "");
  await hero.screenshot({ path: path.join(OUT, "03-hero-page.png"), fullPage: false });
  await hero.close();

  console.log(JSON.stringify({
    out: OUT,
    greeting,
    eyebrowCount,
    tagline,
    draftBadge,
    cardCount,
    heroHeadline,
  }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
