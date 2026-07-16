import { chromium } from "@playwright/test";
import fs from "fs";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";
import { closeAutocomplete, pickPlanOption } from "../e2e/helpers/planFlowHelpers.js";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4210";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(l => l && l.includes("="))
    .map(l => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await installGoogleApiMocks(page);
await page.goto(`${BASE}/?skyHour=12`);
await page.waitForTimeout(1000);
await page.locator(".profile-card-trigger").first().click();
if (!(await page.locator(".profile-card-signout").isVisible({ timeout: 1500 }).catch(() => false))) {
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.locator("#signin-email").fill(env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com");
  await page.locator("#signin-password").fill(env.PLAYWRIGHT_ADMIN_PASSWORD || env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.waitForTimeout(2500);
}
await page.keyboard.press("Escape");
await page.locator(".hero-input").first().fill("Dallas, TX");
await closeAutocomplete(page);
await page.locator(".hero-input").nth(1).fill("Austin, TX");
await closeAutocomplete(page);
await page.locator(".hero-go-btn").click();
await page.locator(".float-card--plan-flow").waitFor({ timeout: 45_000 });

const picks = ["Car", "Gasoline", "No", "Just me"];
for (const label of picks) {
  await pickPlanOption(page, label);
  await page.waitForTimeout(400);
}

// Click stops option — capture transition into preferences step
await pickPlanOption(page, "Just one stop");

const delays = [0, 50, 100, 200, 320, 600];
let elapsed = 0;
for (const delay of delays) {
  await page.waitForTimeout(delay - elapsed);
  elapsed = delay;
  const snap = await page.evaluate(() => ({
    title: document.querySelector(".plan-flow-question-title")?.textContent?.trim(),
    hasEnter: !!document.querySelector(".step-enter"),
    currentH: document.querySelector(".plan-flow-current")?.offsetHeight ?? null,
    scrollH: document.querySelector(".question-options-scroll")?.offsetHeight ?? null,
    gridH: document.querySelector(".plan-option-grid")?.offsetHeight ?? null,
    pillCount: document.querySelectorAll(".plan-option-card").length,
    currentOpacity: getComputedStyle(document.querySelector(".plan-flow-current") || document.body).opacity,
  }));
  console.log(`+${delay}ms`, JSON.stringify(snap));
}

await browser.close();
