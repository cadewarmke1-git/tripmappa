import { chromium } from "@playwright/test";
import fs from "fs";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";
import { closeAutocomplete, pickPlanOption, waitPlanStepReady } from "../e2e/helpers/planFlowHelpers.js";

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

async function reachPreferences(page) {
  await page.goto(`${BASE}/?skyHour=12`, { waitUntil: "domcontentloaded" });
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

  const picks = ["Car", "Gasoline", "No", "Just me", "Just one stop", "Drive straight through"];
  for (let i = 0; i < 20; i++) {
    await waitPlanStepReady(page).catch(() => {});
    const title = await page.locator(".plan-flow-question-title").first().textContent().catch(() => "");
    if (/route preferences/i.test(title || "")) return;
    for (const label of picks) {
      if (await pickPlanOption(page, label)) break;
    }
    const cont = page.locator(".plan-flow-dock-continue, .plan-flow-dock-skip").first();
    if (await cont.isVisible({ timeout: 800 }).catch(() => false)) await cont.click({ force: true });
    picks.shift();
  }
}

const viewports = [[1280, 800], [1280, 600], [1280, 500], [1024, 768], [375, 812]];

for (const [w, h] of viewports) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await installGoogleApiMocks(page);
  await reachPreferences(page);
  await page.waitForTimeout(600);

  const m = await page.evaluate(() => ({
    current: document.querySelector(".plan-flow-current")?.offsetHeight ?? null,
    formBody: document.querySelector(".plan-flow-form-body")?.offsetHeight ?? null,
    scroll: document.querySelector(".question-options-scroll")?.offsetHeight ?? null,
    grid: document.querySelector(".plan-option-grid")?.offsetHeight ?? null,
    currentMinH: getComputedStyle(document.querySelector(".plan-flow-current") || document.body).minHeight,
    scrollMinH: getComputedStyle(document.querySelector(".question-options-scroll") || document.body).minHeight,
    pills: [...document.querySelectorAll(".plan-option-card")].map(c => ({
      label: c.querySelector(".plan-option-card-label")?.textContent?.trim(),
      h: c.offsetHeight,
    })),
  }));

  console.log(JSON.stringify({
    viewport: `${w}x${h}`,
    ...m,
    visiblePills: m.pills.filter(p => p.h > 0).length,
    zeroChain: {
      current: m.current === 0,
      scroll: m.scroll === 0,
      grid: m.grid === 0,
    },
  }));
  await browser.close();
}
