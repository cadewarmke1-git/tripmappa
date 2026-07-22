/**
 * Verify simplified TripDraftPanel: 3 one-tap choices + pinned Generate.
 * PREVIEW_URL=http://127.0.0.1:4193 node scripts/verify-draft-scroll.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4193";
const OUT = path.join(process.cwd(), "tmp", "draft-quick-verify");

async function fillPlace(page, selector, query) {
  const input = page.locator(selector);
  await input.click({ force: true });
  await input.fill("");
  await input.type(query, { delay: 35 });
  await page.waitForTimeout(700);
  const suggestion = page.locator(".pac-item").first();
  if (await suggestion.count()) {
    await suggestion.click({ force: true });
    await page.waitForTimeout(250);
  } else {
    await input.fill(query);
  }
  await page.keyboard.press("Escape").catch(() => null);
}

async function reachDraft(page) {
  await page.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
    window.__TRIPMAPPA_E2E_PROFILE__ = { onboarding_complete: true, tier: "trailblazer" };
    window.__TRIPMAPPA_E2E_CREDITS__ = {
      tier: "trailblazer",
      unlimited: true,
      remaining: 100,
      limit: 100,
    };
  });
  await page.goto(`${BASE}/?skyHour=14`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1000);
  const planNew = page.getByRole("button", { name: /Plan a new trip/i });
  if (await planNew.isVisible().catch(() => false)) {
    await planNew.click();
  } else {
    await page.locator(".hero-plan-cta, .returning-user-action").first().click({ force: true });
  }
  await page.waitForTimeout(800);
  for (const label of [/plan a (new )?trip/i, /start planning/i]) {
    const btn = page.locator("button, a").filter({ hasText: label }).first();
    if (await btn.isVisible().catch(() => false) && !(await page.locator(".plan-route-setup").count())) {
      await btn.click({ force: true }).catch(() => null);
      await page.waitForTimeout(400);
    }
  }
  await page.locator(".plan-route-setup").first().waitFor({ state: "attached", timeout: 30_000 });
  if (await page.locator(".float-card.collapsed").count()) {
    await page.locator(".float-card.collapsed button").last().click({ force: true }).catch(() => null);
  }
  await page.waitForFunction(() => Boolean(window.google?.maps?.places), { timeout: 60_000 }).catch(() => null);
  await fillPlace(page, "#plan-route-origin", "Dallas, TX");
  await fillPlace(page, "#plan-route-dest", "Austin, TX");
  await page.locator(".plan-flow-dock-continue, .plan-flow-action-dock button").filter({ hasText: /Continue/i }).first().click();
  await page.locator(".trip-draft-panel").first().waitFor({ state: "attached", timeout: 30_000 });
  if (await page.locator(".float-card.collapsed").count()) {
    await page.locator(".float-card.collapsed button").last().click({ force: true }).catch(() => null);
  }
  await page.waitForFunction(() => {
    const el = document.querySelector(".trip-draft-panel");
    return el && el.getBoundingClientRect().height > 80;
  }, { timeout: 15_000 });
}

async function runViewport(browser, { width, height, label }) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await reachDraft(page);
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(OUT, `${label}-01-draft.png`), fullPage: false });

  const info = await page.evaluate(() => {
    const generate = document.querySelector(".trip-draft-generate");
    const btns = Array.from(document.querySelectorAll(".trip-draft-quick-btn")).map((b) => ({
      text: b.textContent?.trim(),
      selected: b.classList.contains("is-selected"),
    }));
    const asks = Array.from(document.querySelectorAll(".trip-draft-quick-ask")).map((el) => el.textContent?.trim());
    const counter = document.body.innerText.includes("optional sections reviewed");
    const gen = generate?.getBoundingClientRect();
    return {
      asks,
      btns,
      hasCounter: counter,
      generateText: generate?.textContent?.trim() || null,
      generateInView: Boolean(gen && gen.top < window.innerHeight && gen.bottom > 0),
      quickBtnCount: btns.length,
    };
  });

  await page.getByRole("button", { name: "Just me" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Lots of stops" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${label}-02-after-picks.png`), fullPage: false });

  const after = await page.evaluate(() => ({
    selected: Array.from(document.querySelectorAll(".trip-draft-quick-btn.is-selected")).map((b) => b.textContent?.trim()),
    generateInView: (() => {
      const r = document.querySelector(".trip-draft-generate")?.getBoundingClientRect();
      return Boolean(r && r.top < window.innerHeight && r.bottom > 0);
    })(),
  }));

  await context.close();
  return { label, viewport: { width, height }, info, after };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await runViewport(browser, { width: 1280, height: 800, label: "desktop" });
  const mobile = await runViewport(browser, { width: 375, height: 812, label: "mobile" });
  const report = {
    out: OUT,
    desktop,
    mobile,
    ok: Boolean(
      desktop.info.quickBtnCount === 9
      && !desktop.info.hasCounter
      && desktop.info.generateInView
      && desktop.after.generateInView
      && mobile.info.generateInView
      && desktop.after.selected.includes("Just me")
      && desktop.after.selected.includes("Lots of stops"),
    ),
  };
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
