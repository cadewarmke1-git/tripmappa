import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "profile-menu");

const PROFILE = {
  display_name: "Cade Warmke",
  home_address: "Fort Worth, TX, USA",
  onboarding_complete: true,
  tier: "wanderer",
};
const CREDITS = { tier: "wanderer", unlimited: false, remaining: 2, limit: 3, used: 1 };

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(({ profile, credits }) => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = profile;
    window.__TRIPMAPPA_E2E_CREDITS__ = credits;
  }, { profile: PROFILE, credits: CREDITS });

  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForSelector(".profile-card-trigger", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator(".profile-card-trigger").click();
  await page.waitForSelector(".profile-card-dropdown.is-open", { timeout: 8000 });
  await page.waitForTimeout(400);

  const labels = await page.locator(".profile-card-dropdown.is-open").innerText();
  await page.screenshot({ path: path.join(OUT, "profile-dropdown-desktop.png"), fullPage: false });

  await page.locator(".profile-card-support-toggle").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "profile-dropdown-support-open.png"), fullPage: false });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "profile-dropdown-mobile.png"), fullPage: false });

  console.log(JSON.stringify({ out: OUT, menuText: labels }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
