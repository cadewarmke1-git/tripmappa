/** Capture micro-animation verification screenshots */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "node:child_process";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "tmp", "animation-screenshots");
const PREVIEW_PORT = 4173;
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
    cwd: path.join(__dirname, ".."),
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await installGoogleApiMocks(page);

    // Animation 1 — profile dropdown open
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const trigger = page.locator(".profile-card-trigger").first();
    await trigger.click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT_DIR, "01-profile-dropdown-open.png") });

    // Animation 2 — generate button hover (plan flow ready screen needs auth + flow; hover state)
    await page.keyboard.press("Escape");
    await page.goto(`${BASE}/?neon-showcase`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    // Use plan-ready generate button if on hero after sign-in; fallback: hover any generate btn on showcase won't work
    // Navigate to hero and open plan panel for generate button
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const heroInputs = page.locator(".hero-input");
    if (await heroInputs.count() >= 2) {
      await heroInputs.nth(0).fill("Dallas, TX");
      await heroInputs.nth(1).fill("Austin, TX");
      await page.locator(".hero-go-btn").click();
      await page.waitForTimeout(2000);
    }
    const genBtn = page.locator(".btn-generate-trip").first();
    if (await genBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await genBtn.hover();
      await page.waitForTimeout(350);
      await genBtn.screenshot({ path: path.join(OUT_DIR, "02-generate-shimmer-hover.png") });
    }

    // Animation 4 — neon popup entrance
    await page.goto(`${BASE}/?neon-showcase`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const neonCard = page.locator(".neon-sign-popup-card").first();
    await neonCard.screenshot({ path: path.join(OUT_DIR, "04-neon-sign-popup.png") });

    await browser.close();
    console.log(`Screenshots saved to ${OUT_DIR}`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
