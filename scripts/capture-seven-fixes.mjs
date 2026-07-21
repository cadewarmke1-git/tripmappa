import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4181";
const OUT = path.join(process.cwd(), "tmp", "seven-fixes-verify");

async function authContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
  return context;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = { shots: [], notes: [] };

  // Drive-time select + explore empty-state messaging (injected on live CSS)
  {
    const context = await authContext(browser);
    const page = await context.newPage();
    await page.goto(`${BASE}/?skyHour=21`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("button:has-text('Plan a new trip')").waitFor({ timeout: 45000 });
    await page.evaluate(() => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:24px;right:24px;bottom:24px;z-index:9999;";
      wrap.innerHTML = `
        <div class="hero-explore-range" style="background:#0D0A1A;padding:14px;border-radius:12px;border:1px solid rgba(255,210,140,0.22);">
          <label class="hero-explore-range-toggle">
            <input type="checkbox" checked />
            <span class="hero-explore-range-toggle-ui" aria-hidden="true"></span>
            <span class="hero-explore-range-label">Explore range</span>
          </label>
          <div class="hero-explore-range-controls">
            <span class="hero-explore-range-time-label">Drive time</span>
            <select class="hero-explore-range-select" aria-label="Drive time range">
              <option>1 hour</option>
              <option selected>2 hours</option>
              <option>3 hours</option>
              <option>4 hours</option>
            </select>
            <span class="hero-explore-range-status">2h along your route · 3 stops in range</span>
            <ul class="hero-explore-range-stops">
              <li>Fuel stop · Georgetown</li>
              <li>Lunch · Temple</li>
              <li>Lodging · Waco</li>
            </ul>
          </div>
        </div>`;
      document.body.appendChild(wrap);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "01-explore-range-drive-time.png") });
    report.shots.push("01-explore-range-drive-time.png");
    const selectStyles = await page.evaluate(() => {
      const el = document.querySelector(".hero-explore-range-select");
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color, border: s.borderTopColor };
    });
    report.notes.push({
      exploreSelect: selectStyles,
      note: "Explore UI rendered with production CSS; corridor logic covered by unit tests",
    });
    await context.close();
  }

  // Results warning + hotel card (production CSS on night surface)
  {
    const context = await authContext(browser);
    const page = await context.newPage();
    await page.goto(`${BASE}/?skyHour=21`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("button:has-text('Plan a new trip')").waitFor({ timeout: 45000 });
    await page.evaluate(() => {
      document.documentElement.classList.add("app-wrap");
      document.body.classList.add("app-wrap", "night");
      const panel = document.createElement("div");
      panel.className = "trip-results-panel trip-results-panel-night";
      panel.style.cssText = "position:fixed;inset:56px 0 0;z-index:9998;overflow:auto;padding:24px;background:#0D0A1A;";
      panel.innerHTML = `
        <div class="stale-plan-notice" role="status">
          <div class="stale-plan-notice-text">Your route or preferences changed — results below are from your last generation and may be outdated.</div>
          <button type="button" class="stale-plan-notice-btn">Regenerate trip</button>
        </div>
        <article class="road-trip-stop-card road-trip-stop-card--lodging lodging-card lodging-card-hotel" style="max-width:560px;margin-top:16px;">
          <div class="road-trip-stop-card-thumb"><div class="lodging-card-photo lodging-card-photo-placeholder road-stop-card-photo-fallback"></div></div>
          <div class="road-trip-stop-card-body">
            <span class="road-trip-stop-card-category">Lodging</span>
            <h3 class="road-trip-stop-card-name">The Adolphus Hotel</h3>
            <p class="road-trip-stop-card-meta">
              <span class="road-trip-stop-card-rating">4.6★</span>
              <span class="road-trip-stop-card-sep">·</span>
              <span class="road-trip-stop-card-distance">0.4 mi off route</span>
              <span class="road-trip-stop-card-sep">·</span>
              <span class="lodging-card-meta-text">$189/night</span>
            </p>
            <div class="road-trip-stop-card-actions">
              <button type="button" class="road-trip-stop-card-btn road-trip-stop-card-btn--primary">Choose stay</button>
              <button type="button" class="road-trip-stop-card-btn road-trip-stop-card-btn--secondary">View listing</button>
            </div>
          </div>
        </article>`;
      document.body.appendChild(panel);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "02-results-warning-banner.png") });
    report.shots.push("02-results-warning-banner.png");

    const lodging = page.locator(".road-trip-stop-card--lodging").first();
    await lodging.screenshot({ path: path.join(OUT, "03-hotel-card.png") });
    report.shots.push("03-hotel-card.png");
    const hotelStyles = await lodging.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        borderLeft: `${s.borderLeftWidth} ${s.borderLeftStyle} ${s.borderLeftColor}`,
        ink: getComputedStyle(el.querySelector(".road-trip-stop-card-name")).color,
        cat: getComputedStyle(el.querySelector(".road-trip-stop-card-category")).color,
      };
    });
    report.notes.push({ hotelCard: hotelStyles });

    await page.screenshot({ path: path.join(OUT, "04-results-surface.png") });
    report.shots.push("04-results-surface.png");
    await context.close();
  }

  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
