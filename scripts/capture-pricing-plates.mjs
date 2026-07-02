/** Capture pricing page day + night screenshots. */
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const OUT_DIR = "test-results/pricing-screenshots";
const PREVIEW_PORT = 4176;
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

async function applyTheme(page, mode) {
  await page.evaluate((themeMode) => {
    const bodyTheme = themeMode === "day" ? "theme-day" : "theme-night";
    document.body.classList.remove("theme-day", "theme-twilight", "theme-night");
    document.body.classList.add(bodyTheme);
    document.documentElement.dataset.surfaceTheme = themeMode === "day" ? "day" : "night";
    for (const el of document.querySelectorAll(".app-wrap, .pricing-page")) {
      el.classList.remove("day", "night", "twilight");
      el.classList.add(themeMode === "day" ? "day" : "night");
    }
  }, mode);
}

async function capture(page, themeMode, filename) {
  await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
  await page.waitForSelector(".pricing-plates-grid", { timeout: 15_000 });
  await applyTheme(page, themeMode);
  await page.waitForTimeout(600);
  await page.locator(".pricing-page-main").screenshot({ path: filename });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const preview = startPreview();
  try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 1200 } });

    await capture(page, "day", `${OUT_DIR}/pricing-day.png`);
    await capture(page, "night", `${OUT_DIR}/pricing-night.png`);

    await browser.close();
    console.log(`Saved pricing screenshots to ${OUT_DIR}/`);
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
