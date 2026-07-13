#!/usr/bin/env node
/**
 * Deploy visual gate — CDP checks for north-star cohesion on the live app shell.
 * Run against dev or preview: VERIFY_BASE_URL=http://127.0.0.1:5173 node scripts/visual-verify-deploy.mjs
 */
import { chromium } from "@playwright/test";

const BASE = (process.env.VERIFY_BASE_URL || "http://127.0.0.1:5173").replace(/\/$/, "");

const CHECKS = [
  {
    name: "hero-headline",
    path: "/",
    eval: () => ({
      headline: document.querySelector(".hero-title-line")?.textContent?.trim(),
      eyebrow: document.querySelector(".trip-overview-hero-eyebrow")?.textContent?.trim(),
      ok: document.querySelector(".hero-title-line")?.textContent?.trim() === "Your trip, our mission.",
    }),
  },
  {
    name: "hero-search-opaque",
    path: "/",
    eval: () => {
      const cta = document.querySelector(".hero-plan-cta") || document.querySelector(".hero-go-btn");
      if (!cta) return { ok: false, reason: "missing hero CTA" };
      const search = document.querySelector(".hero-search");
      if (!search) return { ok: true, note: "compact hero CTA only" };
      const bg = getComputedStyle(search).backgroundColor;
      const blur = getComputedStyle(search).backdropFilter;
      return {
        ok: bg !== "rgba(0, 0, 0, 0)" && blur === "none",
        backgroundColor: bg,
        backdropFilter: blur,
      };
    },
  },
  {
    name: "no-banned-copy-in-dom",
    path: "/",
    eval: () => {
      const text = document.body?.innerText || "";
      const banned = ["AI-Powered", "Travel Reimagined", "Your full drive", "#c084fc"];
      const hits = banned.filter(b => text.includes(b));
      return { ok: hits.length === 0, hits };
    },
  },
  {
    name: "plan-flow-form-shell",
    path: "/",
    setup: async (page) => {
      const cta = page.locator(".hero-plan-cta, .hero-go-btn, .returning-user-action--plan").first();
      await cta.click();
      await page.waitForSelector(".plan-flow-form, .float-card--plan-flow, .question-route-setup", { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(800);
    },
    eval: () => ({
      hasPlanForm: !!document.querySelector(".plan-flow-form") || !!document.querySelector(".float-card--plan-flow"),
      chatMetaphor: document.querySelectorAll(".convo-scroll, .ai-bubble, .ai-msg").length,
      qrBtns: document.querySelectorAll(".question-choices .qr-btn").length,
      hasDock: !!document.querySelector(".plan-flow-action-dock"),
      ok: (!!document.querySelector(".plan-flow-form") || !!document.querySelector(".float-card--plan-flow"))
        && document.querySelectorAll(".convo-scroll, .ai-bubble, .ai-msg").length === 0
        && document.querySelectorAll(".question-choices .qr-btn").length === 0,
    }),
  },
  {
    name: "plan-flow-no-competing-actions",
    path: "/",
    setup: async (page) => {
      const cta = page.locator(".hero-plan-cta, .hero-go-btn, .returning-user-action--plan").first();
      await cta.click();
      await page.waitForSelector(".plan-flow-action-dock, .float-card--plan-flow", { timeout: 15000 });
      await page.waitForTimeout(600);
    },
    eval: () => ({
      headerStartOver: document.querySelectorAll(".plan-flow-start-over").length,
      bodyContinueBtns: document.querySelectorAll(".question-choices-shell .btn-generate-inline").length,
      choiceRows: document.querySelectorAll(".question-choices .plan-choice-row").length,
      ok: document.querySelectorAll(".plan-flow-start-over").length === 0
        && document.querySelectorAll(".question-choices-shell .btn-generate-inline").length === 0
        && (document.querySelectorAll(".plan-flow-action-dock").length >= 1
          || !!document.querySelector(".float-card--plan-flow")),
    }),
  },
  {
    name: "hero-search-in-viewport",
    path: "/?skyHour=12",
    eval: () => {
      const target = document.querySelector(".hero-plan-cta")
        || document.querySelector(".hero-go-btn")
        || document.querySelector(".hero-search");
      if (!target) return { ok: false, reason: "missing hero CTA" };
      const r = target.getBoundingClientRect();
      return {
        ok: r.top >= 0 && r.top < window.innerHeight && r.bottom <= window.innerHeight + 2,
        top: r.top,
        bottom: r.bottom,
        viewport: window.innerHeight,
      };
    },
  },
];

async function runCheck(page, check) {
  await page.goto(`${BASE}${check.path}`, { waitUntil: "networkidle" });
  if (check.path === "/") {
    await page.waitForSelector(".hero-title-line", { timeout: 15000 }).catch(() => null);
  }
  if (check.setup) await check.setup(page);
  const result = await page.evaluate(check.eval);
  return { name: check.name, ...result, ok: result.ok !== false };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const failures = [];

  console.log(`[verify:deploy] ${BASE}`);
  for (const check of CHECKS) {
    try {
      const result = await runCheck(page, check);
      if (result.ok) {
        console.log(`  ✓ ${check.name}`);
      } else {
        console.log(`  ✗ ${check.name}`, JSON.stringify(result));
        failures.push(result);
      }
    } catch (err) {
      console.log(`  ✗ ${check.name} (error)`, err.message);
      failures.push({ name: check.name, error: err.message });
    }
  }

  await browser.close();
  if (failures.length) {
    console.error(`[verify:deploy] FAILED (${failures.length} check(s))`);
    process.exit(1);
  }
  console.log("[verify:deploy] All checks passed");
}

main().catch(err => {
  console.error("[verify:deploy] FATAL:", err);
  process.exit(1);
});
