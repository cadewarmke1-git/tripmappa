/**
 * Visual verify: matching returning CTAs + neon popup gate for endpoints.
 */
import { chromium, devices } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4179";
const OUT = path.join(process.cwd(), "tmp", "two-fixes-verify");

const require = createRequire(import.meta.url);
// Load canShowStopPopup via dynamic import of source through vite-less path
const { canShowStopPopup, waypointsToNumberedMarkers } = await import("../src/lib/mapMarkers.js");

const IPHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

const DESKTOP = { viewport: { width: 1280, height: 800 } };

async function shotReturning(browser, viewport, filename) {
  const context = await browser.newContext({
    ...viewport,
    ...(viewport.isMobile ? IPHONE : {}),
  });
  await context.addInitScript(() => {
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
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?skyHour=21&skyTest=0`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".returning-user-action").first().waitFor({ timeout: 45_000 });
  await page.waitForTimeout(800);

  const styles = await page.evaluate(() => {
    return [...document.querySelectorAll(".returning-user-action")].map((el) => {
      const s = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        background: s.backgroundColor,
        color: s.color,
        border: s.borderTopColor,
        height: Math.round(el.getBoundingClientRect().height),
      };
    });
  });

  await page.screenshot({ path: path.join(OUT, filename), fullPage: false });
  await context.close();
  return styles;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const mobileStyles = await shotReturning(browser, IPHONE, "01-returning-buttons-mobile.png");
  const desktopStyles = await shotReturning(browser, DESKTOP, "01-returning-buttons-desktop.png");

  const destMarker = waypointsToNumberedMarkers([{
    id: "destination",
    kind: "destination",
    lat: 32.7767,
    lng: -96.797,
    title: "Dallas, TX",
  }])[0];

  const popupGate = {
    destinationDallas: canShowStopPopup(destMarker),
    origin: canShowStopPopup({ id: "origin-0", category: "poi", role: "origin", title: "Austin, TX" }),
    home: canShowStopPopup({ id: "home_marker", category: "poi", markerType: "home" }),
    restaurantStop: canShowStopPopup({ id: "road-1", category: "restaurant", title: "Lunch stop" }),
    hotelStop: canShowStopPopup({ id: "stop-0", category: "hotel", title: "Cozy Cone Motel" }),
  };

  const report = {
    out: OUT,
    mobileStyles,
    desktopStyles,
    buttonsMatchMobile:
      mobileStyles.length === 2
      && mobileStyles[0].background === mobileStyles[1].background
      && mobileStyles[0].color === mobileStyles[1].color
      && mobileStyles[0].border === mobileStyles[1].border,
    buttonsMatchDesktop:
      desktopStyles.length === 2
      && desktopStyles[0].background === desktopStyles[1].background
      && desktopStyles[0].color === desktopStyles[1].color
      && desktopStyles[0].border === desktopStyles[1].border,
    popupGate,
    neonPopupBlockedForDallas: popupGate.destinationDallas === false,
  };

  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  if (!report.buttonsMatchMobile || !report.buttonsMatchDesktop) {
    process.exitCode = 1;
  }
  if (!report.neonPopupBlockedForDallas) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
