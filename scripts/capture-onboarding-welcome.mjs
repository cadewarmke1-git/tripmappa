/** Capture onboarding welcome screen day + night (isolated markup + built CSS). */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT_DIR = "test-results/onboarding-screenshots";
const PREVIEW_PORT = 4177;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

const WELCOME_HTML = `
<div class="traveler-onboarding traveler-onboarding--THEME traveler-onboarding--welcome-screen" style="position:relative;min-height:100vh;width:100%;max-width:420px;margin:0 auto;">
  <div class="traveler-onboarding-stage">
    <div class="traveler-onboarding-welcome" style="min-height:100vh;">
      <div class="traveler-onboarding-welcome-bg">
        <img class="traveler-onboarding-photo traveler-onboarding-photo--day" src="/hero/open-road-golden-hour.jpg" alt="" />
        <img class="traveler-onboarding-photo traveler-onboarding-photo--night" src="/hero/open-road-twilight.jpg" alt="" />
        <div class="traveler-onboarding-scrim"></div>
      </div>
      <div class="traveler-onboarding-welcome-content">
        <p class="traveler-onboarding-kicker">Welcome to</p>
        <div class="traveler-onboarding-road-dash"></div>
        <h1 class="traveler-onboarding-wordmark" aria-label="TripMappa">
          <span class="traveler-onboarding-wordmark-trip">Trip</span><span class="traveler-onboarding-wordmark-mappa">Mappa</span>
        </h1>
        <p class="traveler-onboarding-tagline">Your trip, our mission.</p>
        <p class="traveler-onboarding-lead">Plan the perfect road trip with curated stops, smart routing, and the open road ahead.</p>
        <button type="button" class="traveler-onboarding-get-started">Get started →</button>
        <p class="traveler-onboarding-signin">Already rolling? <button type="button" class="traveler-onboarding-signin-link">Sign in</button></p>
      </div>
    </div>
  </div>
</div>`;

function waitForServer(url, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Preview server did not start at ${url}`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function startPreview() {
  return spawn("npm", ["run", "preview", "--", "--port", String(PREVIEW_PORT), "--host", "127.0.0.1"], {
    stdio: "pipe",
    shell: true,
  });
}

async function capture(page, theme, path) {
  const html = WELCOME_HTML.replace("THEME", theme);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ markup, themeMode }) => {
    document.body.innerHTML = markup;
    document.body.style.margin = "0";
    document.body.style.background = themeMode === "day" ? "#f5e6c8" : "#0d0a1a";
  }, { markup: html, themeMode: theme });
  await page.waitForTimeout(900);
  await page.locator(".traveler-onboarding-welcome").screenshot({ path });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

    await capture(page, "day", `${OUT_DIR}/onboarding-welcome-day.png`);
    await capture(page, "night", `${OUT_DIR}/onboarding-welcome-night.png`);

    await browser.close();
    console.log(`Saved onboarding screenshots to ${OUT_DIR}/`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
