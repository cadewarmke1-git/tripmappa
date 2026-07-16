import { chromium } from "@playwright/test";
import fs from "fs";
import { installGoogleApiMocks } from "../e2e/helpers/googleApiMocks.js";
import { closeAutocomplete, waitPlanStepReady } from "../e2e/helpers/planFlowHelpers.js";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4187";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await installGoogleApiMocks(page);
await page.goto(`${BASE}/?skyHour=12`);
await page.waitForTimeout(1200);
await page.locator(".profile-card-trigger").first().click();
if (!(await page.locator(".profile-card-signout").isVisible({ timeout: 1500 }).catch(() => false))) {
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.locator("#signin-email").fill(env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com");
  await page.locator("#signin-password").fill(env.PLAYWRIGHT_ADMIN_PASSWORD || env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.waitForTimeout(3000);
}
await page.keyboard.press("Escape");
await page.locator(".hero-input").first().fill("Dallas, TX");
await closeAutocomplete(page);
await page.locator(".hero-input").nth(1).fill("Austin, TX");
await closeAutocomplete(page);
await page.locator(".hero-go-btn").click();
await page.locator(".float-card--plan-flow").waitFor({ timeout: 45000 });
await waitPlanStepReady(page).catch(() => {});
await page.waitForTimeout(2000);

const diag = await page.evaluate(() => {
  const chain = [
    ".float-card--plan-flow",
    ".float-card-body--plan-flow",
    ".float-card-scroll",
    ".plan-flow-form",
    ".plan-flow-form-body",
    ".plan-flow-stack",
    ".plan-flow-body",
    ".plan-flow-main",
    ".plan-flow-current",
    ".question-choices-shell-compact",
    ".question-choices-compact",
    ".question-options-scroll",
    ".plan-option-grid",
    ".plan-option-card",
  ];
  const sizes = {};
  for (const sel of chain) {
    const el = document.querySelector(sel);
    if (!el) {
      sizes[sel] = null;
      continue;
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    sizes[sel] = {
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      opacity: cs.opacity,
      overflow: cs.overflow,
      display: cs.display,
      flex: cs.flex,
    };
  }
  const cards = [...document.querySelectorAll(".plan-option-card")].slice(0, 3).map((c) => {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return {
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      opacity: cs.opacity,
      bg: cs.backgroundColor,
      color: cs.color,
      text: c.querySelector(".plan-option-card-label")?.textContent?.trim(),
    };
  });
  return { sizes, cards, enter: !!document.querySelector(".step-enter") };
});

console.log(JSON.stringify(diag, null, 2));
await browser.close();
