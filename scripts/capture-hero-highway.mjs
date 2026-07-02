/** Capture hero day/night screenshots via sky hour URL params. */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT_DIR = "test-results/hero-highway-screenshots";
const PREVIEW_PORT = 4174;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}`;

function waitForServer(url, timeoutMs = 30000) {
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

async function capture(page, url, path) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".hero-highway-scene", { timeout: 15_000 });
  await page.waitForTimeout(900);
  await page.locator(".hero").screenshot({ path });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    await capture(page, `${BASE}/?skyHour=12&skyTest=0`, `${OUT_DIR}/hero-day.png`);
    await capture(page, `${BASE}/?skyHour=21&skyTest=0`, `${OUT_DIR}/hero-night.png`);

    await browser.close();
    console.log(`Saved hero screenshots to ${OUT_DIR}/`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
