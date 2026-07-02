/** Capture neon popup showcase screenshots (4 categories × day/night grid). */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT_DIR = "test-results/neon-popup-screenshots";
const PREVIEW_PORT = 4173;
const BASE = `http://127.0.0.1:${PREVIEW_PORT}/?neon-showcase`;

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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 2400 } });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${OUT_DIR}/neon-popups-full-grid.png`,
      fullPage: true,
    });

    const cards = page.locator(".neon-sign-popup-card");
    const count = await cards.count();
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      const mode = i < 4 ? "day" : "night";
      const categories = ["food", "fuel", "lodging", "general"];
      const category = categories[i % 4];
      await card.screenshot({ path: `${OUT_DIR}/${category}-${mode}.png` });
    }

    await browser.close();
    console.log(`Saved ${count + 1} screenshots to ${OUT_DIR}/`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
