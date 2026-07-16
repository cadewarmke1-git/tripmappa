/**
 * Supplemental captures: stop frequency + luxury + generation loader
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const BASE = "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "visual-audit-pass");
const EMAIL = "tripmappa@gmail.com";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[t.slice(0, eq).trim()] = val;
  }
  return out;
}

function encodeSse(events) {
  return events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

async function pick(page, label) {
  const card = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: label }),
  }).first();
  if (await card.isVisible({ timeout: 2500 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const btn = page.getByRole("button", { name: new RegExp(`^${label}`, "i") }).first();
  if (await btn.isVisible({ timeout: 1200 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}

async function waitTitle(page, re, timeout = 30000) {
  await page.waitForFunction(
    (pattern) => {
      const el = document.querySelector(".plan-flow-question-title");
      return el && new RegExp(pattern, "i").test(el.textContent || "");
    },
    re.source,
    { timeout },
  ).catch(() => null);
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForSelector(".profile-card-trigger", { timeout: 45000 });
  await page.waitForTimeout(1500);
  await page.locator(".profile-card-trigger").click({ force: true });
  if (await page.locator(".profile-card-signout").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    return true;
  }
  await page.locator(".profile-card-nav-link", { hasText: /^Sign in$/i }).first().click({ force: true });
  await page.locator("#signin-email").fill(email);
  await page.locator("#signin-password").fill(password);
  await page.locator(".auth-modal-submit").click();
  await page.locator(".auth-modal-overlay").waitFor({ state: "hidden", timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(2000);
  return true;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const env = loadEnvLocal();
  const password = env.ADMIN_PASSWORD || env.PLAYWRIGHT_ADMIN_PASSWORD;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await signIn(page, EMAIL, password);

  await page.goto(`${BASE}/?skyHour=14&skyTest=0`);
  await page.waitForTimeout(1500);
  await page.locator(".returning-user-action--plan, .hero-plan-cta").first().click();
  await page.waitForSelector(".float-card--plan-flow", { timeout: 45000 });
  await waitTitle(page, /Where are you headed/);
  await page.locator("#plan-route-origin").fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator("#plan-route-dest").fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".plan-flow-dock-continue, .btn-generate-inline").first().click();
  await waitTitle(page, /How are you traveling/);
  await pick(page, "Car");
  await waitTitle(page, /run on|fuel|Gasoline/i);
  await pick(page, "Gasoline");
  await waitTitle(page, /towing|trailer/i);
  await pick(page, "No");
  await waitTitle(page, /How many are joining/i);
  await pick(page, "Just me");
  await waitTitle(page, /How often do you want to stop/i);
  const stopTitle = await page.locator(".plan-flow-question-title").innerText();
  const stopOptions = await page.locator(".plan-option-card-label").allTextContents();
  await page.screenshot({ path: path.join(OUT, "04b2-stop-frequency.png") });

  if (stopOptions[0]) await pick(page, stopOptions[0].trim());
  else await page.locator(".plan-option-card").first().click();

  await waitTitle(page, /budget level|luxury|hotel/i);
  const luxuryTitle = await page.locator(".plan-flow-question-title").innerText();
  const luxurySlider = await page.locator(".plan-star-slider").isVisible().catch(() => false);
  await page.screenshot({ path: path.join(OUT, "04c2-luxury-stars.png") });
  if (luxurySlider) {
    await page.locator(".plan-star-slider-track").click({ position: { x: 140, y: 22 } });
    await page.waitForTimeout(500);
  }

  // Drive to generate
  for (let i = 0; i < 14; i++) {
    if (await page.locator(".btn-generate-trip").isVisible({ timeout: 700 }).catch(() => false)) break;
    const title = await page.locator(".plan-flow-question-title").innerText().catch(() => "");
    console.log("step", i, title.slice(0, 80));
    if (await page.locator(".plan-option-card").first().isVisible().catch(() => false)) {
      await page.locator(".plan-option-card").first().click();
      await page.waitForTimeout(550);
      continue;
    }
    if (await page.locator(".plan-star-slider").isVisible().catch(() => false)) {
      await page.locator(".plan-star-slider-track").click({ position: { x: 140, y: 22 } });
      await page.waitForTimeout(550);
      continue;
    }
    const cont = page.locator(".plan-flow-dock-continue").first();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click();
      await page.waitForTimeout(600);
      continue;
    }
    const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
      continue;
    }
    // preference pills / free text
    const textArea = page.locator("textarea").first();
    if (await textArea.isVisible().catch(() => false)) {
      await textArea.fill("scenic lakes");
      if (await cont.isVisible().catch(() => false)) await cont.click();
      await page.waitForTimeout(500);
      continue;
    }
    break;
  }

  await page.route("**/api/plan-trip", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((r) => setTimeout(r, 3500));
    const body = encodeSse([
      { event: "start", data: { maxTokens: 4096 } },
      { event: "progress", data: { phase: "route", message: "Routing" } },
      { event: "complete", data: { route_summary: "Dallas to Austin", stops: [{ city: "Waco, TX", name: "Waco", lat: 31.55, lng: -97.15 }], road_stops: [], tips: [] } },
    ]);
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body,
    });
  });

  const gen = page.locator(".btn-generate-trip").first();
  const genVisible = await gen.isVisible().catch(() => false);
  let loader = { genVisible, stopTitle, stopOptions, luxuryTitle, luxurySlider };
  if (genVisible) {
    await gen.click({ force: true }).catch(async () => gen.evaluate((el) => el.click()));
    await page.waitForTimeout(700);
    loader.overlay = await page.locator(".generation-stream-overlay").isVisible().catch(() => false);
    loader.wordmark = await page.locator(".pulsing-wordmark, .generation-stream-wordmark, .brand-wordmark").first().isVisible().catch(() => false);
    loader.wordmarkClass = await page.locator(".pulsing-wordmark, .generation-stream-wordmark").first().getAttribute("class").catch(() => null);
    loader.centeredInfo = await page.locator(".pulsing-wordmark, .generation-stream-wordmark, .brand-wordmark").first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { className: el.className, text: el.textContent, cx: r.left + r.width / 2, cy: r.top + r.height / 2, vw: innerWidth, vh: innerHeight };
    }).catch(() => null);
    await page.screenshot({ path: path.join(OUT, "07b-generation-loader.png") });
  } else {
    await page.screenshot({ path: path.join(OUT, "07b-generation-stuck.png") });
    loader.stuckTitle = await page.locator(".plan-flow-question-title").innerText().catch(() => "");
  }

  console.log(JSON.stringify(loader, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
