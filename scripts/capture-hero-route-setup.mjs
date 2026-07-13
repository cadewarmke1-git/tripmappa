import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "hero-route-setup-screenshots");

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const contexts = [
    { label: "desktop", width: 1280, height: 800 },
    { label: "mobile", width: 375, height: 812 },
  ];

  for (const { label, width, height } of contexts) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`);
    await page.waitForTimeout(2500);
    await capture(page, `hero-${label}.png`);

    const cta = page.locator(".hero-plan-cta");
    await cta.waitFor({ state: "visible", timeout: 90_000 });
    await cta.click();
    await page.locator(".float-card--plan-flow").waitFor({ timeout: 45_000 });
    await page.waitForTimeout(800);
    await capture(page, `route-setup-${label}.png`);

    await page.locator("#plan-route-origin").fill("Dallas, TX");
    await closeAutocomplete(page);
    await page.locator("#plan-route-dest").fill("Los Angeles, CA");
    await closeAutocomplete(page);
    await page.waitForTimeout(400);
    await capture(page, `route-setup-filled-${label}.png`);

    await page.close();
  }

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
