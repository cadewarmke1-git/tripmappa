/**
 * Visual verify: stop-card remove X + inline confirmation on results.
 * Run against preview: PREVIEW_URL=http://127.0.0.1:4190 node scripts/verify-stop-remove.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4190";
const OUT = path.join(process.cwd(), "tmp", "stop-remove-verify");

const FIXTURE_TRIP = {
  id: "verify-stop-remove-1",
  origin: "Dallas, TX",
  dest: "Austin, TX",
  date: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  answers: {
    vehicle: "Car",
    fuel_type: "Gasoline",
    stop_frequency: "Moderate",
    luxury_level: "3",
    adult_count: 2,
    child_count: 0,
  },
  stops: [],
  roadStops: [
    {
      id: "road-verify-fuel-1",
      name: "Buc-ee's Temple",
      location: "Temple, TX",
      category: "Fuel",
      rating: 4.6,
      lat: 31.0982,
      lng: -97.3428,
      userAdded: true,
      distanceMiles: 0.4,
      photoUrl: null,
      note: "Fuel and rest stop along the route",
    },
    {
      id: "road-verify-food-1",
      name: "Torchy's Tacos",
      location: "Waco, TX",
      category: "Food",
      rating: 4.4,
      lat: 31.5493,
      lng: -97.1467,
      userAdded: true,
      distanceMiles: 0.8,
    },
  ],
  routeInfo: {
    distance: "195 mi",
    duration: "3 hours",
    originLat: 32.7767,
    originLng: -96.797,
    destLat: 30.2672,
    destLng: -97.7431,
    routePoints: [
      { lat: 32.7767, lng: -96.797 },
      { lat: 31.5493, lng: -97.1467 },
      { lat: 31.0982, lng: -97.3428 },
      { lat: 30.2672, lng: -97.7431 },
    ],
  },
  tripTips: [],
  personalTouches: [],
  changesMade: [],
  selectedLodging: [],
};

function tripToRow(trip) {
  return {
    id: trip.id,
    user_id: "e2e-user",
    origin: trip.origin,
    dest: trip.dest,
    trip_date: trip.date,
    created_at: trip.createdAt,
    stops: trip.stops,
    road_stops: trip.roadStops,
    trip_tips: trip.tripTips,
    answers: trip.answers,
    route_info: trip.routeInfo,
    selected_lodging: trip.selectedLodging,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  await context.route("**/rest/v1/trips*", async (route) => {
    const method = route.request().method();
    const row = tripToRow(FIXTURE_TRIP);
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": "0-0/1" },
        body: JSON.stringify([row]),
      });
      return;
    }
    // migrate upsert / save
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(row),
    });
  });

  await context.addInitScript((trip) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = {
      display_name: "Cade Warmke",
      onboarding_complete: true,
      tier: "founder",
    };
    window.__TRIPMAPPA_E2E_CREDITS__ = {
      tier: "founder",
      unlimited: true,
      remaining: 999,
      limit: 999,
    };
    localStorage.setItem("tripmappa-saved:v1", JSON.stringify([trip]));
    localStorage.setItem("tripmappa-saved", JSON.stringify([trip]));
  }, FIXTURE_TRIP);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(`${BASE}/?skyHour=21`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".returning-user-continue-trips, .returning-user-greeting").first()
    .waitFor({ timeout: 45_000 });

  // Wait until trips hydrate from mocked API (Continue trips needs savedTripsCount > 0)
  await page.locator(".returning-user-continue-trips").first()
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(500);

  // Prefer: menu → My trips → Resume (loads results via handleViewTrip)
  await page.getByRole("button", { name: /Profile menu/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /My trips/i }).click();
  await page.locator(".trips-panel, .trips-saved-card").first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(400);

  const resume = page.getByRole("button", { name: /Resume trip/i }).first();
  await resume.waitFor({ state: "visible", timeout: 15_000 });
  await resume.click();

  await page.locator(".trip-results-panel").first().waitFor({ timeout: 20_000 });
  await page.locator(".road-trip-stop-card, .result-card-remove-trigger").first()
    .waitFor({ timeout: 15_000 });
  await page.waitForTimeout(600);

  const removeBtn = page.locator(".result-card-remove-trigger").first();
  await removeBtn.waitFor({ state: "visible", timeout: 10_000 });
  await removeBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const card = page.locator(".road-trip-stop-card")
    .filter({ has: page.locator(".result-card-remove-trigger") })
    .first();

  await card.screenshot({ path: path.join(OUT, "01-remove-x-visible.png") });
  await page.screenshot({
    path: path.join(OUT, "01-results-remove-x-desktop.png"),
    fullPage: false,
  });

  await removeBtn.click();
  await page.locator(".result-card-remove-confirm").first()
    .waitFor({ state: "visible", timeout: 5_000 });
  await page.waitForTimeout(250);

  // Confirm replaces the X on that card — select by confirm UI, not remove trigger
  const confirmCard = page.locator(".road-trip-stop-card")
    .filter({ has: page.locator(".result-card-remove-confirm") })
    .first();
  await confirmCard.screenshot({ path: path.join(OUT, "02-remove-confirm-inline.png") });
  await page.screenshot({
    path: path.join(OUT, "02-results-remove-confirm-desktop.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  if (!(await page.locator(".result-card-remove-confirm").first().isVisible().catch(() => false))) {
    const mobileRemove = page.locator(".result-card-remove-trigger").first();
    if (await mobileRemove.isVisible().catch(() => false)) {
      await mobileRemove.click();
      await page.locator(".result-card-remove-confirm").first()
        .waitFor({ state: "visible", timeout: 5_000 });
    }
  }
  await page.screenshot({
    path: path.join(OUT, "03-results-remove-confirm-mobile.png"),
    fullPage: false,
  });

  const report = {
    out: OUT,
    removeVisible: await page.locator(".result-card-remove-trigger").count(),
    confirmVisible: await page.locator(".result-card-remove-confirm").count(),
    confirmText: await page.locator(".result-card-remove-confirm-label").first()
      .textContent()
      .catch(() => null),
    confirmButtons: await page.locator(".result-card-remove-confirm-btn")
      .allTextContents()
      .catch(() => []),
    firstCardName: await page.locator(".road-trip-stop-card-name").first()
      .textContent()
      .catch(() => null),
    shareModeClass: await page.locator(".trip-results-panel--shared").count(),
    consoleErrors,
    shots: [
      "01-remove-x-visible.png",
      "01-results-remove-x-desktop.png",
      "02-remove-confirm-inline.png",
      "02-results-remove-confirm-desktop.png",
      "03-results-remove-confirm-mobile.png",
    ],
  };

  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  if (!report.confirmVisible) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
