/**
 * Per-fix screenshot helper for mobile 390×844.
 * Usage: node scripts/shot-fix.mjs <fixId>
 *   fix1 = vehicle step cards visible
 *   fix2 = continue trips → results
 *   fix3 = route setup FROM+TO
 *   fix4 = open navigate contrast
 *   fix5 = day contrast titles
 *   fix6 = dock 44px
 *   fix7 = swap 44px
 */
import { chromium, devices } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const OUT = path.join(process.cwd(), "tmp", "mobile-fix-shots");
const EMAIL = process.env.AUDIT_EMAIL || "tripmappa@gmail.com";
const PASSWORD = process.env.AUDIT_PASSWORD || process.env.ADMIN_PASSWORD || "";
const fixId = process.argv[2] || "fix1";

function loadAdminPassword() {
  if (PASSWORD) return PASSWORD;
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return "";
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*ADMIN_PASSWORD\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  return "";
}

const IPHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
};

async function signIn(page, password) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  // Already on returning dashboard?
  if (await page.locator(".returning-user-greeting, .returning-user-action--plan").first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    return;
  }
  const trigger = page.locator(".profile-card-trigger").first();
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  if (await page.locator(".profile-card-signout").isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    return;
  }
  const signInBtn = page.getByRole("button", { name: /^Sign [Ii]n$/ }).first();
  await signInBtn.click({ timeout: 10_000 });
  await page.locator("#signin-email").fill(EMAIL);
  await page.locator("#signin-password").fill(password);
  await page.locator(".auth-modal").getByRole("button", { name: /Sign [Ii]n/i }).last().click();
  await page.waitForTimeout(2500);
  await page.locator(".returning-user-action--plan, .hero-plan-cta, .float-card--plan-flow").first().waitFor({ timeout: 30_000 }).catch(() => {});
}

async function goToVehicleStep(page) {
  await page.locator(".returning-user-action--plan, .hero-plan-cta").first().click();
  await page.locator("#plan-route-origin").waitFor({ timeout: 45_000 });
  await page.locator("#plan-route-origin").fill("Dallas, TX");
  await page.keyboard.press("Escape");
  await page.locator("#plan-route-dest").fill("Austin, TX");
  await page.keyboard.press("Escape");
  await page.locator(".plan-flow-dock-continue").click();
  await page.locator(".plan-flow-question-title").filter({ hasText: /traveling/i }).waitFor({ timeout: 25_000 });
  await page.waitForTimeout(600);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const password = loadAdminPassword();
  if (!password) throw new Error("Need ADMIN_PASSWORD");
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...IPHONE });
  const page = await context.newPage();
  await signIn(page, password);

  let metrics = {};
  if (fixId === "fix1" || fixId === "fix3" || fixId === "fix5" || fixId === "fix6" || fixId === "fix7") {
    if (fixId === "fix3" || fixId === "fix7") {
      await page.locator(".returning-user-action--plan, .hero-plan-cta").first().click();
      await page.locator("#plan-route-origin").waitFor({ timeout: 45_000 });
      await page.waitForTimeout(500);
    } else {
      await goToVehicleStep(page);
    }
  }

  if (fixId === "fix1") {
    metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll(".plan-option-card")].map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.innerText.slice(0, 30), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), visible: r.height > 20 && r.bottom > 0 && r.top < window.innerHeight - 60 };
      });
      const scroll = document.querySelector(".question-options-scroll");
      const dock = document.querySelector(".plan-flow-action-dock");
      const dr = dock?.getBoundingClientRect();
      return {
        cardCount: cards.length,
        visibleCards: cards.filter((c) => c.visible).length,
        cards,
        hasOptionsScroll: Boolean(scroll),
        scrollH: scroll ? Math.round(scroll.getBoundingClientRect().height) : 0,
        dockBottom: dr ? Math.round(dr.bottom) : null,
        vh: window.innerHeight,
      };
    });
  }

  if (fixId === "fix2") {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.locator(".returning-user-continue-trips").click({ timeout: 10_000 });
    await page.waitForTimeout(2500);
    metrics = await page.evaluate(() => ({
      hasResults: Boolean(document.querySelector(".trip-results-split, .road-trip-stop-card, .stop-card")),
      hasStartNav: [...document.querySelectorAll("button")].some((b) => /start navigation/i.test(b.innerText || "")),
      hasNavigatePanel: Boolean(document.querySelector(".navigate-route-panel")),
      tabHint: document.body.innerText.slice(0, 200),
    }));
  }

  if (fixId === "fix3") {
    metrics = await page.evaluate(() => {
      const from = document.querySelector("#plan-route-origin")?.getBoundingClientRect();
      const to = document.querySelector("#plan-route-dest")?.getBoundingClientRect();
      const swap = document.querySelector(".plan-route-setup-swap")?.getBoundingClientRect();
      return {
        fromVisible: from && from.top >= 0 && from.bottom <= window.innerHeight,
        toVisible: to && to.top >= 0 && to.bottom <= window.innerHeight - 50,
        fromTop: from && Math.round(from.top),
        toTop: to && Math.round(to.top),
        swapH: swap && Math.round(swap.height),
        swapW: swap && Math.round(swap.width),
      };
    });
  }

  if (fixId === "fix4") {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    metrics = await page.evaluate(() => {
      const el = document.querySelector(".returning-user-action--navigate");
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, h: Math.round(el.getBoundingClientRect().height) };
    });
  }

  if (fixId === "fix5") {
    metrics = await page.evaluate(() => {
      function parseRgb(str) {
        const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      }
      function lum([r, g, b]) {
        const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      function ratio(fg, bg) {
        const L1 = lum(fg), L2 = lum(bg);
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      }
      const title = document.querySelector(".plan-flow-question-title");
      const step = document.querySelector(".plan-flow-step-label");
      const cream = [253, 243, 224];
      const tc = parseRgb(getComputedStyle(title).color);
      const sc = parseRgb(getComputedStyle(step).color);
      return { titleColor: tc, stepColor: sc, titleRatio: tc ? ratio(tc, cream).toFixed(2) : null, stepRatio: sc ? ratio(sc, cream).toFixed(2) : null };
    });
  }

  if (fixId === "fix6") {
    metrics = await page.evaluate(() => {
      const start = document.querySelector(".plan-flow-dock-start-over, .plan-flow-dock-btn");
      const back = document.querySelector(".plan-flow-dock-back");
      return {
        startH: start && Math.round(start.getBoundingClientRect().height),
        backH: back && Math.round(back.getBoundingClientRect().height),
      };
    });
  }

  if (fixId === "fix7") {
    metrics = await page.evaluate(() => {
      const swap = document.querySelector(".plan-route-setup-swap");
      const r = swap?.getBoundingClientRect();
      return { w: r && Math.round(r.width), h: r && Math.round(r.height) };
    });
  }

  const file = path.join(OUT, `${fixId}-390.png`);
  await page.screenshot({ path: file, fullPage: false });
  await writeFile(path.join(OUT, `${fixId}-metrics.json`), JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify({ fixId, file, metrics }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
