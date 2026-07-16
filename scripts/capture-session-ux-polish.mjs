import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "session-ux-polish");

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  const ret = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await ret.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = {
      display_name: "Cade Warmke",
      home_address: "Fort Worth, TX, USA",
      onboarding_complete: true,
      tier: "wanderer",
    };
    window.__TRIPMAPPA_E2E_CREDITS__ = {
      tier: "wanderer",
      unlimited: false,
      remaining: 2,
      limit: 3,
      used: 1,
    };
    localStorage.setItem(
      "tripmappa-saved:v1",
      JSON.stringify([
        {
          id: "mock-trip",
          origin: "Dallas, TX, USA",
          dest: "Los Angeles, CA, USA",
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          answers: { vehicle: "RV" },
          stops: [],
          roadStops: [],
          routeInfo: {
            distance: "1,440 mi",
            duration: "20 hours",
            routePoints: [
              { lat: 32.78, lng: -96.8 },
              { lat: 34.05, lng: -118.24 },
            ],
          },
        },
      ]),
    );
  });
  await ret.goto(`${BASE}/?skyHour=12&skyTest=0`);
  await ret.waitForSelector(".returning-user-actions", { timeout: 20000 });
  await ret.waitForTimeout(900);
  const btnBox = await ret.locator(".returning-user-action--plan").boundingBox();
  console.log(JSON.stringify({ returningPlanBtn: btnBox }));
  await ret.screenshot({
    path: path.join(OUT, "01-returning-buttons-desktop.png"),
    fullPage: false,
  });

  await ret.context().grantPermissions(["geolocation"]);
  await ret.context().setGeolocation({ latitude: 32.7555, longitude: -97.3308 });
  await ret.locator(".returning-user-action--navigate").click();
  await ret.waitForSelector(".navigate-route-panel", { timeout: 20000 });
  await ret.waitForTimeout(5000);
  const carCount = await ret.locator('[aria-label="Vintage car map marker"]').count();
  const originVal = await ret.locator("#navigate-origin").inputValue().catch(() => "");
  console.log(JSON.stringify({ navCarElements: carCount, origin: originVal }));
  await ret.screenshot({
    path: path.join(OUT, "02-navigate-gps-desktop.png"),
    fullPage: false,
  });
  await ret.close();

  const hero = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await hero.addInitScript(() => {
    try {
      sessionStorage.removeItem("tm-hero-welcome-played");
    } catch {
      /* ignore */
    }
  });
  await hero.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await hero.waitForSelector(".hero-plan-cta", { timeout: 20000 });
  await hero.waitForTimeout(250);
  await hero.screenshot({
    path: path.join(OUT, "03-hero-welcome-early.png"),
    fullPage: false,
  });
  await hero.waitForTimeout(1500);
  await hero.screenshot({
    path: path.join(OUT, "03b-hero-welcome-settled.png"),
    fullPage: false,
  });
  const played = await hero.evaluate(() => sessionStorage.getItem("tm-hero-welcome-played"));
  console.log(JSON.stringify({ heroPlayed: played }));

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
