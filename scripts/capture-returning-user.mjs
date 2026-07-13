import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://localhost:4173";
const OUT = path.join(process.cwd(), "tmp", "returning-user-screenshots");

const MOCK_TRIP = {
  id: "mock-trip-dallas-la",
  origin: "Dallas, TX, USA",
  dest: "Los Angeles, CA, USA",
  date: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  answers: { vehicle: "RV", fuel_type: "Gasoline", travelers: "2" },
  stops: [
    { city: "El Paso, TX", name: "Franklin Mountains", lat: 31.79, lng: -106.42 },
    { city: "Tucson, AZ", name: "Desert Museum", lat: 32.24, lng: -111.17 },
    { city: "Phoenix, AZ", name: "Camelback Mountain", lat: 33.52, lng: -112.07 },
  ],
  roadStops: [
    { name: "Buc-ee's", lat: 32.45, lng: -97.79, category: "Fuel" },
  ],
  routeInfo: {
    distance: "1,440 mi",
    duration: "20 hours",
    routePoints: [
      { lat: 32.78, lng: -96.8 },
      { lat: 32.45, lng: -97.79 },
      { lat: 31.79, lng: -106.42 },
      { lat: 32.24, lng: -111.17 },
      { lat: 33.52, lng: -112.07 },
      { lat: 34.05, lng: -118.24 },
    ],
  },
};

const MOCK_DRAFT = {
  origin: "Austin, TX",
  dest: "San Antonio, TX",
  answers: { vehicle: "Car" },
  questionHistory: [],
  convoComplete: false,
  savedAt: Date.now(),
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.addInitScript(({ trip, draft, profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
    localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
    localStorage.setItem("tripmappa-plan-draft:v1", JSON.stringify(draft));
  }, {
    trip: MOCK_TRIP,
    draft: MOCK_DRAFT,
    profile: {
      display_name: "Cade Warmke",
      home_address: "Fort Worth, TX, USA",
      onboarding_complete: true,
      tier: "wanderer",
    },
    credits: { tier: "wanderer", unlimited: false, remaining: 2, limit: 3, used: 1 },
  });

  await page.goto(`${BASE}/?skyHour=12&skyTest=0`);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(OUT, "returning-with-trip-desktop.png"), fullPage: false });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "returning-with-trip-mobile.png"), fullPage: false });

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
