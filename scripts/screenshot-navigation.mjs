/** Capture navigation cockpit screenshots (desktop + mobile). */
import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const BASE = process.env.PREVIEW_URL || "http://localhost:5180";

async function capture(page, name) {
  await mkdir("tmp/screenshots", { recursive: true });
  const path = `tmp/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`Saved ${path}`);
  return path;
}

async function main() {
  const browser = await chromium.launch();
  for (const [label, viewport] of [["nav-desktop", { width: 1280, height: 800 }], ["nav-mobile", { width: 375, height: 812 }]]) {
    const context = await browser.newContext({ viewport, geolocation: { latitude: 41.8781, longitude: -87.6298 }, permissions: ["geolocation"] });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByRole("button", { name: "Navigate" }).click();
    await page.locator("#navigate-origin").fill("Chicago, IL");
    await page.locator("#navigate-dest").fill("Milwaukee, WI");
    await page.getByRole("button", { name: "Get route" }).click();
    await page.waitForTimeout(4000);
    await capture(page, label);
    await context.close();
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
