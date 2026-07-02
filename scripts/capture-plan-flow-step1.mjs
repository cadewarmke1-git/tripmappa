/** Capture plan flow Step 1 (vehicle) day + night screenshots. */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT_DIR = "test-results/plan-flow-screenshots";
const PREVIEW_PORT = 4175;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

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

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

async function applyAppTheme(page, mode) {
  await page.evaluate((themeMode) => {
    const bodyTheme = themeMode === "day" ? "theme-day" : "theme-night";
    document.body.classList.remove("theme-day", "theme-twilight", "theme-night");
    document.body.classList.add(bodyTheme);
    document.documentElement.dataset.surfaceTheme = themeMode === "day" ? "day" : "night";
    for (const el of document.querySelectorAll(".app-wrap, .float-card")) {
      el.classList.remove("day", "night", "twilight");
      el.classList.add(themeMode === "day" ? "day" : "night");
    }
  }, mode);
}

async function startVehicleStep(page, skyHour, themeMode) {
  await page.goto(`${BASE}/?skyHour=${skyHour}&skyTest=0`);
  await page.waitForTimeout(900);
  await page.locator(".hero-input").first().fill("Chicago, IL");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Los Angeles, CA");
  await closeAutocomplete(page);
  const goBtn = page.locator(".hero-go-btn");
  await goBtn.waitFor({ state: "visible", timeout: 90_000 });
  await goBtn.click();
  await page.locator(".float-card--plan-flow").waitFor({ state: "visible", timeout: 45_000 });
  await applyAppTheme(page, themeMode);
  await page.locator(".plan-flow-question-title").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".plan-option-card").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);
}

async function capture(page, path) {
  const panel = page.locator(".float-card--plan-flow");
  await panel.screenshot({ path });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 420, height: 820 } });

    await startVehicleStep(page, 12, "day");
    await capture(page, `${OUT_DIR}/plan-step1-day.png`);

    await startVehicleStep(page, 21, "night");
    await capture(page, `${OUT_DIR}/plan-step1-night.png`);

    await browser.close();
    console.log(`Saved plan flow screenshots to ${OUT_DIR}/`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
