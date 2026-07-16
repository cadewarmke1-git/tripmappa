/**
 * Mobile-only visual/functional audit (iPhone 14: 390×844).
 * Audit only — no product code changes.
 *
 * Usage:
 *   $env:PREVIEW_URL='http://127.0.0.1:4173'
 *   $env:AUDIT_EMAIL='tripmappa@gmail.com'
 *   $env:AUDIT_PASSWORD='...'
 *   node scripts/mobile-visual-audit.mjs
 */
import { chromium, devices } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
const EMAIL = process.env.AUDIT_EMAIL || process.env.PLAYWRIGHT_ADMIN_EMAIL || "tripmappa@gmail.com";
const PASSWORD = process.env.AUDIT_PASSWORD || process.env.PLAYWRIGHT_ADMIN_PASSWORD || "";
const OUT = path.join(process.cwd(), "tmp", "mobile-audit-390");

const IPHONE = {
  ...devices["iPhone 14"],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
};

const findings = [];
const surfaces = [];
let shotIndex = 0;

function flag(surface, severity, category, message, detail = {}) {
  findings.push({ surface, severity, category, message, ...detail });
}

function relLum([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg, bg) {
  const L1 = relLum(fg);
  const L2 = relLum(bg);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

function parseRgb(str) {
  if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") return null;
  const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

async function shot(page, name) {
  shotIndex += 1;
  const file = `${String(shotIndex).padStart(2, "0")}-${name}.png`;
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: false });
  return file;
}

async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    let dismissed = false;
    const confirm = page.locator(".confirm-dialog-overlay");
    if (await confirm.isVisible({ timeout: 300 }).catch(() => false)) {
      await confirm.locator(".confirm-dialog-cancel, .confirm-dialog-confirm").first().click().catch(() => {});
      dismissed = true;
      await page.waitForTimeout(250);
    }
    const draft = page.locator(".hero-draft-resume-dismiss");
    if (await draft.isVisible({ timeout: 300 }).catch(() => false)) {
      await draft.click().catch(() => {});
      dismissed = true;
      await page.waitForTimeout(250);
    }
    if (!dismissed) break;
  }
}

async function measureTapTargets(page, selector, surface, labelPrefix = "") {
  const results = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    return els.slice(0, 40).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const text = (el.innerText || el.getAttribute("aria-label") || el.id || el.className || "").toString().slice(0, 60);
      return {
        text,
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.x),
        y: Math.round(r.y),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none",
        pointerEvents: cs.pointerEvents,
      };
    });
  }, selector);

  for (const el of results) {
    if (!el.visible) continue;
    if (el.h > 0 && el.h < 44) {
      flag(surface, "high", "tap-target", `${labelPrefix}${el.text || selector} height ${el.h}px < 44`, el);
    }
    if (el.w > 0 && el.w < 44 && el.h >= 44 && /icon|btn|button|chip/i.test(selector + el.text)) {
      flag(surface, "medium", "tap-target", `${labelPrefix}${el.text || selector} width ${el.w}px < 44`, el);
    }
  }
  return results;
}

async function checkOverflow(page, surface) {
  const data = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const clientW = doc.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("button, a, input, .plan-option-card, .float-card, .auth-modal, .returning-user-shell, .navigate-route-panel, .settings-page, .trip-results-split, .profile-card-dropdown")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0) continue;
      if (r.right > clientW + 2 || r.left < -2) {
        offenders.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
      }
    }
    return { scrollW, clientW, overflowX: scrollW > clientW + 2, offenders: offenders.slice(0, 12) };
  });
  if (data.overflowX) {
    flag(surface, "high", "overflow", `Horizontal scroll: scrollWidth ${data.scrollW} > clientWidth ${data.clientW}`, data);
  }
  for (const o of data.offenders) {
    flag(surface, "medium", "overflow", `Element spills viewport: ${o.tag}.${o.cls}`, o);
  }
  return data;
}

async function sampleContrast(page, surface, selectors) {
  const samples = await page.evaluate((sels) => {
    function parseRgb(str) {
      if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") return null;
      const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    function bgBehind(el) {
      let n = el;
      while (n && n !== document.documentElement) {
        const bg = parseRgb(getComputedStyle(n).backgroundColor);
        if (bg) return bg;
        n = n.parentElement;
      }
      return [13, 10, 26];
    }
    return sels.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      return {
        sel,
        text: (el.innerText || "").slice(0, 80),
        color: parseRgb(cs.color),
        bg: bgBehind(el),
        fontSize: cs.fontSize,
      };
    });
  }, selectors);

  for (const s of samples) {
    if (s.missing || !s.color || !s.bg) continue;
    const ratio = contrastRatio(s.color, s.bg);
    if (ratio < 4.5) {
      flag(surface, "high", "contrast", `Contrast ${ratio.toFixed(2)}:1 < 4.5 for ${s.sel} ("${s.text}")`, s);
    }
  }
  return samples;
}

async function describeVisible(page) {
  return page.evaluate(() => {
    const title = document.querySelector(".hero-title, .returning-user-greeting, .plan-flow-question-title, .settings-page-title, .auth-modal h2, .auth-modal-title")?.innerText?.trim() || "";
    const bodyHint = document.body?.innerText?.slice(0, 280)?.replace(/\s+/g, " ") || "";
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return { title, bodyHint, vw, vh, url: location.href };
  });
}

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(200);
}

async function signOutIfNeeded(page) {
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await dismissOverlays(page);
  const trigger = page.locator(".profile-card-trigger").first();
  if (!(await trigger.isVisible({ timeout: 5_000 }).catch(() => false))) return;
  await trigger.click();
  const signOut = page.locator(".profile-card-signout, button:has-text('Sign out')").first();
  if (await signOut.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await signOut.click();
    await page.waitForTimeout(1000);
  } else {
    await page.keyboard.press("Escape");
  }
}

async function signIn(page) {
  if (!PASSWORD) throw new Error("AUDIT_PASSWORD / PLAYWRIGHT_ADMIN_PASSWORD required for signed-in surfaces");
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  const trigger = page.locator(".profile-card-trigger").first();
  await trigger.waitFor({ state: "visible", timeout: 45_000 });
  await trigger.click();

  const already = await page.locator(".profile-card-signout").isVisible({ timeout: 1_500 }).catch(() => false);
  if (already) {
    await page.keyboard.press("Escape");
    return;
  }

  await page.getByRole("button", { name: "Sign In", exact: true }).click({ timeout: 10_000 });
  await page.locator("#signin-email").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("#signin-email").fill(EMAIL);
  await page.locator("#signin-password").fill(PASSWORD);
  await page.locator(".auth-modal").getByRole("button", { name: /Sign In/i }).click();
  await page.locator(".auth-modal").waitFor({ state: "hidden", timeout: 45_000 }).catch(async () => {
    await page.locator(".auth-modal").waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  });
  await page.waitForTimeout(1500);
}

async function recordSurface(page, id, name, notes) {
  const file = await shot(page, id);
  const desc = await describeVisible(page);
  const overflow = await checkOverflow(page, name);
  surfaces.push({ id, name, file, notes, desc, overflowX: overflow.overflowX });
  return file;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...IPHONE,
    locale: "en-US",
  });
  const page = await context.newPage();

  const report = { base: BASE, email: EMAIL, passwordProvided: Boolean(PASSWORD), surfaces, findings, score: null, topBugs: [] };

  // ——— 1. Hero signed out ———
  try {
    await signOutIfNeeded(page);
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);

    const heroMetrics = await page.evaluate(() => {
      const cta = document.querySelector(".hero-plan-cta");
      const title = document.querySelector(".hero-title, .hero-headline, h1");
      const founder = document.querySelector(".founder-strip, .hero-founder, [class*='founder']");
      const photo = document.querySelector(".hero-scene img, .hero-bg, .hero-photo, .hero-mountain, .hero-visual, canvas, .hero-surface");
      const ctaBox = cta?.getBoundingClientRect();
      const titleBox = title?.getBoundingClientRect();
      return {
        ctaText: cta?.innerText?.trim() || null,
        ctaH: ctaBox ? Math.round(ctaBox.height) : 0,
        ctaW: ctaBox ? Math.round(ctaBox.width) : 0,
        ctaFullish: ctaBox ? ctaBox.width >= window.innerWidth * 0.85 : false,
        titleText: title?.innerText?.trim()?.slice(0, 120) || null,
        titleReadable: titleBox ? titleBox.height > 20 && getComputedStyle(title).opacity !== "0" : false,
        founderVisible: Boolean(founder && founder.getBoundingClientRect().height > 0),
        founderText: founder?.innerText?.trim()?.slice(0, 100) || null,
        hasHeroVisual: Boolean(photo),
        scrollH: document.documentElement.scrollHeight,
        vh: window.innerHeight,
      };
    });

    await measureTapTargets(page, ".hero-plan-cta, .hero-navigate-cta, .profile-card-trigger", "1 Hero signed out");
    await sampleContrast(page, "1 Hero signed out", [".hero-title", ".hero-plan-cta", ".hero-subhead", ".hero-tagline"]);
    await recordSurface(page, "01-hero-signed-out", "1 Hero signed out", heroMetrics);

    if (!heroMetrics.ctaH || heroMetrics.ctaH < 44) flag("1 Hero signed out", "high", "tap-target", `Plan CTA height ${heroMetrics.ctaH}px`);
    if (!heroMetrics.ctaFullish) flag("1 Hero signed out", "medium", "layout", `Plan CTA not full-width-ish (${heroMetrics.ctaW}px)`);
    if (!heroMetrics.founderVisible) flag("1 Hero signed out", "medium", "layout", "Founder strip not visible in viewport/DOM");
    if (!heroMetrics.titleReadable) flag("1 Hero signed out", "high", "layout", "Headline missing or not readable");
  } catch (err) {
    flag("1 Hero signed out", "critical", "error", String(err));
    await shot(page, "01-hero-ERROR").catch(() => {});
  }

  // ——— 2. Auth modal ———
  try {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    const trigger = page.locator(".profile-card-trigger").first();
    await trigger.click();
    const signInBtn = page.getByRole("button", { name: "Sign In", exact: true });
    if (await signInBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await signInBtn.click();
    } else {
      // Maybe already showing signup from Plan CTA path — open sign in via Plan or modal
      await page.keyboard.press("Escape");
      await page.locator(".hero-plan-cta").click().catch(() => {});
      await page.waitForTimeout(800);
      // Prefer email sign-in modal if signup showed
      const switchSignIn = page.getByRole("button", { name: /Sign [Ii]n/i }).first();
      if (await page.locator(".auth-modal, .email-modal, [class*='auth']").isVisible({ timeout: 3_000 }).catch(() => false)) {
        // ok
      } else if (await switchSignIn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await switchSignIn.click();
      }
    }

    await page.locator(".auth-modal, .signin-modal, #signin-email").first().waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(500);

    const authMetrics = await page.evaluate(() => {
      const modal = document.querySelector(".auth-modal, .signin-modal, .email-modal");
      const r = modal?.getBoundingClientRect();
      const inputs = [...document.querySelectorAll(".auth-modal input, #signin-email, #signin-password")].map((el) => {
        const b = el.getBoundingClientRect();
        return { id: el.id, h: Math.round(b.height), w: Math.round(b.width) };
      });
      const social = [...document.querySelectorAll(".auth-modal button, .auth-social-btn")].map((el) => ({
        text: el.innerText?.trim()?.slice(0, 40),
        h: Math.round(el.getBoundingClientRect().height),
        visible: el.getBoundingClientRect().height > 0,
      }));
      return {
        modalW: r ? Math.round(r.width) : 0,
        modalH: r ? Math.round(r.height) : 0,
        modalTop: r ? Math.round(r.top) : null,
        modalBottom: r ? Math.round(r.bottom) : null,
        fitsWidth: r ? r.width <= window.innerWidth + 2 : false,
        fitsHeight: r ? r.bottom <= window.innerHeight + 4 && r.top >= -4 : false,
        inputs,
        social,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });

    await measureTapTargets(page, ".auth-modal input, .auth-modal button, #signin-email, #signin-password", "2 Auth modal");
    await recordSurface(page, "02-auth-modal", "2 Auth modal", authMetrics);

    if (!authMetrics.fitsWidth) flag("2 Auth modal", "critical", "overflow", `Modal wider than viewport (${authMetrics.modalW} > ${authMetrics.vw})`);
    if (!authMetrics.fitsHeight) flag("2 Auth modal", "high", "overflow", `Modal clipped vertically top=${authMetrics.modalTop} bottom=${authMetrics.modalBottom} vh=${authMetrics.vh}`);
    for (const inp of authMetrics.inputs) {
      if (inp.h < 44) flag("2 Auth modal", "high", "tap-target", `Input #${inp.id} height ${inp.h}px < 44`);
    }

    // If we have password, actually sign in from here; else leave modal for screenshot then close
    if (PASSWORD) {
      if (await page.locator("#signin-email").isVisible().catch(() => false)) {
        await page.locator("#signin-email").fill(EMAIL);
        await page.locator("#signin-password").fill(PASSWORD);
        await page.locator(".auth-modal").getByRole("button", { name: /Sign In/i }).click();
        await page.waitForTimeout(2500);
      }
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
  } catch (err) {
    flag("2 Auth modal", "critical", "error", String(err));
    await shot(page, "02-auth-ERROR").catch(() => {});
  }

  if (!PASSWORD) {
    report.blocked = "No AUDIT_PASSWORD — signed-in surfaces 3–10 skipped";
    report.score = null;
    await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ blocked: report.blocked, findingsCount: findings.length, surfaces: surfaces.map(s => s.file) }, null, 2));
    await browser.close();
    process.exit(2);
  }

  // Ensure signed in
  try {
    await signIn(page);
  } catch (err) {
    flag("auth", "critical", "error", `Sign-in failed: ${err}`);
    await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    await browser.close();
    process.exit(1);
  }

  // ——— 3. Returning user dashboard ———
  try {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);

    const dash = await page.evaluate(() => {
      const byText = (sel, re) => [...document.querySelectorAll(sel)].find((el) => re.test(el.innerText || ""));
      const greeting = document.querySelector(".returning-user-greeting, .returning-user-hello, h1, .hero-title");
      const plan = document.querySelector(".returning-user-action--plan") || byText("button", /plan/i);
      const nav = document.querySelector(".returning-user-action--navigate") || byText("button", /navigate/i);
      const chips = [...document.querySelectorAll(".quick-nav-chip, .returning-user-chip, .navigate-chip")].map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.innerText?.trim()?.slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) };
      });
      const continueTrips = document.querySelector(".continue-trips, .returning-user-trips, .returning-user-trip-card, [class*='continue-trip']");
      return {
        greeting: greeting?.innerText?.trim()?.slice(0, 120) || null,
        planH: plan ? Math.round(plan.getBoundingClientRect().height) : 0,
        navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
        chips,
        chipsOverflow: chips.some((c) => c.right > window.innerWidth + 2),
        continueVisible: Boolean(continueTrips && continueTrips.getBoundingClientRect().height > 0),
        bodyHasHighway: Boolean(document.querySelector("img, .hero-scene, .returning-user-bg, .hero-visual")),
      };
    });

    await measureTapTargets(page, ".returning-user-action--plan, .returning-user-action--navigate, .quick-nav-chip, .returning-user-chip", "3 Returning dashboard");
    await recordSurface(page, "03-returning-dashboard", "3 Returning dashboard", dash);
    if (dash.planH && dash.planH < 44) flag("3 Returning dashboard", "high", "tap-target", `Plan button ${dash.planH}px`);
    if (dash.navH && dash.navH < 44) flag("3 Returning dashboard", "high", "tap-target", `Navigate button ${dash.navH}px`);
    if (dash.chipsOverflow) flag("3 Returning dashboard", "high", "overflow", "Quick navigate chips overflow viewport");
  } catch (err) {
    flag("3 Returning dashboard", "critical", "error", String(err));
    await shot(page, "03-dash-ERROR").catch(() => {});
  }

  // ——— 4. Route setup ———
  try {
    await dismissOverlays(page);
    const planCta = page.locator(".returning-user-action--plan, .hero-plan-cta").first();
    await planCta.click({ timeout: 15_000 });
    await page.locator(".float-card--plan-flow, #plan-route-origin").first().waitFor({ timeout: 45_000 });
    await page.waitForTimeout(800);

    const route = await page.evaluate(() => {
      const from = document.querySelector("#plan-route-origin");
      const to = document.querySelector("#plan-route-dest");
      const cont = document.querySelector(".plan-flow-dock-continue");
      const fr = from?.getBoundingClientRect();
      const tr = to?.getBoundingClientRect();
      const cr = cont?.getBoundingClientRect();
      return {
        fromVisible: Boolean(fr && fr.height > 0),
        toVisible: Boolean(tr && tr.height > 0),
        fromH: fr ? Math.round(fr.height) : 0,
        toH: tr ? Math.round(tr.height) : 0,
        continueVisible: Boolean(cr && cr.height > 0 && cr.bottom <= window.innerHeight + 8),
        continueH: cr ? Math.round(cr.height) : 0,
        continueBottom: cr ? Math.round(cr.bottom) : null,
        vh: window.innerHeight,
        title: document.querySelector(".plan-flow-question-title")?.innerText?.trim() || null,
      };
    });

    await measureTapTargets(page, "#plan-route-origin, #plan-route-dest, .plan-flow-dock-continue, .plan-route-setup-swap", "4 Route setup");
    await recordSurface(page, "04-route-setup", "4 Route setup", route);
    if (!route.fromVisible || !route.toVisible) flag("4 Route setup", "critical", "layout", "FROM/TO not both visible");
    if (!route.continueVisible) flag("4 Route setup", "critical", "layout", "Continue not visible in viewport");
    if (route.continueH && route.continueH < 44) flag("4 Route setup", "high", "tap-target", `Continue ${route.continueH}px`);

    await page.locator("#plan-route-origin").fill("Dallas, TX");
    await closeAutocomplete(page);
    await page.locator("#plan-route-dest").fill("Austin, TX");
    await closeAutocomplete(page);
    await page.locator(".plan-flow-dock-continue").click();
    await page.locator(".plan-flow-question-title").filter({ hasText: /traveling/i }).waitFor({ timeout: 25_000 });
  } catch (err) {
    flag("4 Route setup", "critical", "error", String(err));
    await shot(page, "04-route-ERROR").catch(() => {});
  }

  // ——— 5. Question flow steps ———
  const flowSteps = [
    { id: "05-vehicle", name: "5a Vehicle", pick: "Car", expectNext: /fuel|Gasoline|What does your vehicle/i },
    { id: "06-fuel", name: "5b Fuel", pick: "Gasoline", expectNext: /tow|travelers|joining/i },
    { id: "07-after-fuel", name: "5c After fuel", pick: null, expectNext: null },
  ];

  async function auditQuestionStep(page, id, name) {
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const title = document.querySelector(".plan-flow-question-title")?.innerText?.trim() || "";
      const cards = [...document.querySelectorAll(".plan-option-card, .plan-choice-row, .qr-btn")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: el.innerText?.trim()?.slice(0, 40),
          h: Math.round(r.height),
          clipped: r.bottom > window.innerHeight - 60 || r.top < 0,
          right: Math.round(r.right),
        };
      });
      const dock = document.querySelector(".plan-flow-action-dock, .plan-flow-dock-continue");
      const dr = dock?.getBoundingClientRect();
      const scrollEl = document.querySelector(".float-card-scroll, .plan-flow-form-body, .convo-stage") || document.documentElement;
      const cs = getComputedStyle(scrollEl);
      return {
        title,
        cards,
        dockVisible: Boolean(dr && dr.height > 0 && dr.bottom <= window.innerHeight + 8),
        dockBottom: dr ? Math.round(dr.bottom) : null,
        scrollbarColor: cs.scrollbarColor || null,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        vh: window.innerHeight,
      };
    });

    await measureTapTargets(page, ".plan-option-card, .plan-choice-row, .plan-flow-dock-continue, .plan-flow-dock-back, .plan-flow-dock-start-over", name);
    await sampleContrast(page, name, [".plan-flow-question-title", ".plan-option-card-label", ".plan-flow-step-label"]);
    await recordSurface(page, id, name, metrics);

    if (!metrics.title) flag(name, "high", "layout", "Missing step header");
    if (!metrics.dockVisible) flag(name, "critical", "layout", "Dock/Continue not visible at bottom");
    if (metrics.overflowX) flag(name, "high", "overflow", "Horizontal overflow on question step");
    const clipped = metrics.cards.filter((c) => c.clipped);
    if (clipped.length > 2) flag(name, "medium", "layout", `${clipped.length} option cards clipped by viewport/dock`);
    // Gold scrollbar hard to detect via CSS alone on WebKit — note if white thumb likely
    if (metrics.scrollbarColor && /rgb\(255,\s*255,\s*255\)|#fff|white/i.test(metrics.scrollbarColor)) {
      flag(name, "low", "visual", `Scrollbar color looks white: ${metrics.scrollbarColor}`);
    }
    return metrics;
  }

  try {
    // Vehicle
    let m = await auditQuestionStep(page, "05-vehicle", "5a Vehicle");
    const car = page.locator(".plan-option-card").filter({ has: page.locator(".plan-option-card-label", { hasText: "Car", exact: true }) }).first();
    await car.click();
    await page.waitForTimeout(700);

    // Fuel
    await page.locator(".plan-flow-question-title").first().waitFor({ timeout: 15_000 });
    m = await auditQuestionStep(page, "06-fuel", "5b Fuel");
    const gas = page.locator(".plan-option-card, .plan-choice-row, button").filter({ hasText: /^Gasoline$/i }).first();
    if (await gas.isVisible({ timeout: 5_000 }).catch(() => false)) await gas.click();
    else await page.getByRole("button", { name: /Gasoline/i }).first().click();
    await page.waitForTimeout(700);

    // Towing (often next)
    await page.locator(".plan-flow-question-title").first().waitFor({ timeout: 15_000 });
    m = await auditQuestionStep(page, "07-towing", "5c Towing");
    const noTow = page.locator(".plan-option-card, .plan-choice-row, button").filter({ hasText: /^No$/i }).first();
    if (await noTow.isVisible({ timeout: 4_000 }).catch(() => false)) await noTow.click();
    else {
      const skip = page.locator(".plan-flow-dock-skip").first();
      if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) await skip.click();
    }
    await page.waitForTimeout(700);

    // Travelers
    await page.locator(".plan-flow-question-title").first().waitFor({ timeout: 15_000 });
    m = await auditQuestionStep(page, "08-travelers", "5d Travelers");
    const justMe = page.locator(".plan-option-card, .plan-choice-row").filter({ hasText: /Just me/i }).first();
    if (await justMe.isVisible({ timeout: 4_000 }).catch(() => false)) await justMe.click();
    await page.waitForTimeout(700);

    // Stop frequency / stop count
    await page.locator(".plan-flow-question-title").first().waitFor({ timeout: 15_000 });
    m = await auditQuestionStep(page, "09-stops", "5e Stops");
    const few = page.locator(".plan-option-card, .plan-choice-row").filter({ hasText: /few|Just one|2-3|Surprise/i }).first();
    if (await few.isVisible({ timeout: 4_000 }).catch(() => false)) await few.click();
    await page.waitForTimeout(700);

    // Luxury / preferences-ish
    await page.locator(".plan-flow-question-title").first().waitFor({ timeout: 15_000 });
    m = await auditQuestionStep(page, "10-luxury-or-next", "5f Luxury/next");
    const lux = page.locator(".plan-option-card, .plan-choice-row").filter({ hasText: /Comfortable|Standard|Budget|Luxury|Scenic/i }).first();
    if (await lux.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await lux.click();
      await page.waitForTimeout(600);
      await auditQuestionStep(page, "11-after-luxury", "5g After luxury");
    }
  } catch (err) {
    flag("5 Question flow", "critical", "error", String(err));
    await shot(page, "05-flow-ERROR").catch(() => {});
  }

  // ——— 6. Results — saved trip ———
  try {
    // Go home / trips
    await page.locator(".brand-wordmark, a[aria-label*='home' i], button:has-text('TripMappa')").first().click({ timeout: 5_000 }).catch(() => {});
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await dismissOverlays(page);

    // Open continue trip or trips panel
    const continueTrip = page.locator(".returning-user-trip-card, .continue-trip-card, .saved-trip-card, button:has-text('Open'), button:has-text('View')").first();
    let opened = false;
    if (await continueTrip.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await continueTrip.click();
      opened = true;
    } else {
      // Try profile → trips or nav
      await page.locator(".profile-card-trigger").click();
      const trips = page.getByRole("button", { name: /Trips|My trips|Saved/i }).first();
      if (await trips.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await trips.click();
        await page.waitForTimeout(800);
        const card = page.locator(".trip-card, .saved-trip-card, .trips-panel button, .trips-list-item").first();
        if (await card.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await card.click();
          opened = true;
        }
      } else {
        await page.keyboard.press("Escape");
      }
    }

    await page.waitForTimeout(2000);
    const resultsVisible = await page.locator(".trip-results-split, .road-trip-stop-card, .btn-start-nav, button:has-text('Start Navigation'), button:has-text('Start navigation')").first().isVisible({ timeout: 8_000 }).catch(() => false);

    const results = await page.evaluate(() => {
      const byText = (sel, re) => [...document.querySelectorAll(sel)].find((el) => re.test((el.innerText || el.getAttribute("aria-label") || "").trim()));
      const cards = [...document.querySelectorAll(".road-trip-stop-card, .stop-card, .itinerary-card")].slice(0, 5).map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), fullish: r.width >= window.innerWidth * 0.85, text: el.innerText?.slice(0, 40) };
      });
      const start = document.querySelector(".btn-start-nav, .start-navigation-btn") || byText("button", /start navigation/i);
      const share = document.querySelector(".share-btn") || byText("button", /^share$/i);
      const edit = document.querySelector(".edit-trip-btn") || byText("button", /edit/i);
      const sr = start?.getBoundingClientRect();
      return {
        cards,
        startH: sr ? Math.round(sr.height) : 0,
        startW: sr ? Math.round(sr.width) : 0,
        startFull: sr ? sr.width >= window.innerWidth * 0.85 : false,
        shareVisible: Boolean(share && share.getBoundingClientRect().height > 0),
        editVisible: Boolean(edit && edit.getBoundingClientRect().height > 0),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    });

    await recordSurface(page, "12-results", "6 Results", { opened, resultsVisible, ...results });
    if (!opened || !resultsVisible) flag("6 Results", "high", "functional", "Could not open a saved trip / results not visible");
    if (results.startH && results.startH < 44) flag("6 Results", "high", "tap-target", `Start Navigation ${results.startH}px`);
    if (results.startW && !results.startFull) flag("6 Results", "medium", "layout", `Start Navigation not full width (${results.startW}px)`);
    if (results.overflowX) flag("6 Results", "high", "overflow", "Horizontal scroll on results");
  } catch (err) {
    flag("6 Results", "critical", "error", String(err));
    await shot(page, "12-results-ERROR").catch(() => {});
  }

  // ——— 7. Navigate tab ———
  try {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await dismissOverlays(page);
    const navBtn = page.locator(".returning-user-action--navigate, .hero-navigate-cta, button:has-text('Navigate')").first();
    await navBtn.click({ timeout: 10_000 });
    await page.locator(".navigate-route-panel").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);

    // Touch search bar expand
    const search = page.locator(".navigate-where-search, #navigate-dest, .search-bar-animated").first();
    if (await search.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await search.tap({ timeout: 5_000 }).catch(async () => { await search.click(); });
      await page.waitForTimeout(600);
    }

    const navMetrics = await page.evaluate(() => {
      const byText = (sel, re) => [...document.querySelectorAll(sel)].find((el) => re.test((el.innerText || "").trim()));
      const panel = document.querySelector(".navigate-route-panel");
      const go = document.querySelector(".navigate-route-go");
      const home = document.querySelector(".navigate-route-home-btn") || byText("button", /navigate home/i);
      const map = document.querySelector(".navigate-map-fullscreen, .map-full, .gm-style");
      const fromInput = document.querySelector("#navigate-origin");
      const fromLabel = [...document.querySelectorAll("label")].find((el) => /^from$/i.test((el.innerText || "").trim()));
      const goR = go?.getBoundingClientRect();
      const mapR = map?.getBoundingClientRect();
      return {
        hasFrom: Boolean((fromInput && fromInput.getBoundingClientRect().height > 0) || (fromLabel && fromLabel.getBoundingClientRect().height > 0)),
        goH: goR ? Math.round(goR.height) : 0,
        homeVisible: Boolean(home && home.getBoundingClientRect().height > 0),
        mapH: mapR ? Math.round(mapR.height) : 0,
        mapFills: mapR ? mapR.height >= window.innerHeight * 0.35 : false,
        panelText: panel?.innerText?.slice(0, 120) || null,
      };
    });

    await measureTapTargets(page, ".navigate-route-go, .navigate-route-home-btn, .navigate-where-search button, .search-bar-animated", "7 Navigate");
    await recordSurface(page, "13-navigate", "7 Navigate", navMetrics);
    if (navMetrics.hasFrom) flag("7 Navigate", "high", "layout", "From field still visible (should be dest-only)");
    if (navMetrics.goH && navMetrics.goH < 44) flag("7 Navigate", "high", "tap-target", `Get route ${navMetrics.goH}px`);
    if (!navMetrics.mapFills) flag("7 Navigate", "medium", "layout", `Map height only ${navMetrics.mapH}px — may not fill remaining space`);
  } catch (err) {
    flag("7 Navigate", "critical", "error", String(err));
    await shot(page, "13-navigate-ERROR").catch(() => {});
  }

  // ——— 8. Navigation cockpit ———
  try {
    // Try get route to somewhere if we have location; else open saved trip navigation
    const destInput = page.locator("#navigate-dest, .navigate-where-search input").first();
    if (await destInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await destInput.fill("Austin, TX").catch(() => {});
      await closeAutocomplete(page);
      await page.locator(".navigate-route-go").click().catch(() => {});
      await page.waitForTimeout(3000);
    }

    // Or Start Navigation from results if available
    const startNav = page.locator("button:has-text('Start Navigation'), button:has-text('Start navigation')").first();
    if (await startNav.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await startNav.click();
      await page.waitForTimeout(2000);
    }

    const cockpit = await page.evaluate(() => {
      const tbt = document.querySelector(".turn-by-turn-panel, .nav-cockpit, .tbt-panel, [class*='turn-by-turn']");
      const dist = document.querySelector(".tbt-distance, .nav-distance, [class*='distance']");
      const toast = document.querySelector(".nav-toast, .navigation-alert, .toast, [class*='alert-toast']");
      const car = document.querySelector("[class*='car-marker'], .nav-car, img[alt*='car' i]");
      const tr = tbt?.getBoundingClientRect();
      const toastR = toast?.getBoundingClientRect();
      return {
        tbtVisible: Boolean(tr && tr.height > 0),
        tbtH: tr ? Math.round(tr.height) : 0,
        tbtBottom: tr ? Math.round(tr.bottom) : null,
        distanceText: dist?.innerText?.trim()?.slice(0, 40) || null,
        distanceFs: dist ? parseFloat(getComputedStyle(dist).fontSize) : null,
        toastPos: toastR ? { top: Math.round(toastR.top), right: Math.round(window.innerWidth - toastR.right) } : null,
        carVisible: Boolean(car),
        bodyHint: document.body.innerText.slice(0, 200),
      };
    });

    await recordSurface(page, "14-cockpit", "8 Navigation cockpit", cockpit);
    if (!cockpit.tbtVisible) flag("8 Navigation cockpit", "high", "functional", "Turn-by-turn panel not visible (may need GPS/route)");
    if (cockpit.distanceFs && cockpit.distanceFs < 18) flag("8 Navigation cockpit", "medium", "visual", `Distance font ${cockpit.distanceFs}px may be too small`);
  } catch (err) {
    flag("8 Navigation cockpit", "critical", "error", String(err));
    await shot(page, "14-cockpit-ERROR").catch(() => {});
  }

  // ——— 9. Profile menu ———
  try {
    await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.locator(".profile-card-trigger").first().tap({ timeout: 8_000 }).catch(async () => {
      await page.locator(".profile-card-trigger").first().click();
    });
    await page.waitForTimeout(500);

    const menu = await page.evaluate(() => {
      const dd = document.querySelector(".profile-card-dropdown.is-open, .profile-card-dropdown");
      const r = dd?.getBoundingClientRect();
      const items = [...(dd?.querySelectorAll("button, a") || [])].map((el) => {
        const b = el.getBoundingClientRect();
        return { text: el.innerText?.trim()?.slice(0, 40), h: Math.round(b.height), w: Math.round(b.width) };
      });
      return {
        open: Boolean(dd && r && r.height > 0),
        top: r ? Math.round(r.top) : null,
        bottom: r ? Math.round(r.bottom) : null,
        left: r ? Math.round(r.left) : null,
        right: r ? Math.round(r.right) : null,
        fits: r ? r.right <= window.innerWidth + 4 && r.left >= -4 && r.bottom <= window.innerHeight + 4 : false,
        items,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });

    await measureTapTargets(page, ".profile-card-dropdown button, .profile-card-dropdown a", "9 Profile menu");
    await recordSurface(page, "15-profile-menu", "9 Profile menu", menu);
    if (!menu.open) flag("9 Profile menu", "critical", "functional", "Profile dropdown did not open");
    if (menu.open && !menu.fits) flag("9 Profile menu", "high", "overflow", `Menu spills viewport L${menu.left} R${menu.right} B${menu.bottom}`);
    for (const it of menu.items || []) {
      if (it.h > 0 && it.h < 44) flag("9 Profile menu", "high", "tap-target", `Menu item "${it.text}" ${it.h}px`);
    }
  } catch (err) {
    flag("9 Profile menu", "critical", "error", String(err));
    await shot(page, "15-profile-ERROR").catch(() => {});
  }

  // ——— 10. Settings ———
  try {
    const settingsBtn = page.getByRole("button", { name: /Settings/i }).first();
    if (await settingsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settingsBtn.click();
    } else {
      await page.locator(".profile-card-trigger").click().catch(() => {});
      await page.getByRole("button", { name: /Settings/i }).first().click({ timeout: 5_000 });
    }
    await page.waitForTimeout(1000);

    const settings = await page.evaluate(() => {
      const pageEl = document.querySelector(".settings-page, [class*='settings']");
      const bg = pageEl ? getComputedStyle(pageEl).backgroundColor : getComputedStyle(document.body).backgroundColor;
      const rows = [...document.querySelectorAll(".settings-row, .settings-item, .settings-page button, .settings-page a")].map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.innerText?.trim()?.slice(0, 40), h: Math.round(r.height) };
      });
      const r = pageEl?.getBoundingClientRect();
      return {
        bg,
        fullBleed: pageEl ? Math.round(r.width) >= window.innerWidth - 2 : false,
        rows: rows.slice(0, 20),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        title: document.querySelector(".settings-page-title, h1")?.innerText?.trim() || null,
      };
    });

    await measureTapTargets(page, ".settings-row, .settings-item, .settings-page button", "10 Settings");
    await recordSurface(page, "16-settings", "10 Settings", settings);
    const darkish = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i.exec(settings.bg || "");
    if (darkish) {
      const [_, r, g, b] = darkish;
      if (Number(r) + Number(g) + Number(b) > 120) flag("10 Settings", "medium", "visual", `Background may not be full-bleed night dark: ${settings.bg}`);
    }
    if (!settings.fullBleed) flag("10 Settings", "medium", "layout", "Settings surface may not be full-bleed width");
    if (settings.overflowX) flag("10 Settings", "high", "overflow", "Horizontal overflow on Settings");
  } catch (err) {
    flag("10 Settings", "critical", "error", String(err));
    await shot(page, "16-settings-ERROR").catch(() => {});
  }

  // Score
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;
  let score = 10;
  score -= critical * 1.5;
  score -= high * 0.6;
  score -= medium * 0.25;
  score -= low * 0.1;
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  const impactOrder = ["critical", "high", "medium", "low"];
  const categoryImpact = { functional: 0, overflow: 1, "tap-target": 2, layout: 3, contrast: 4, visual: 5, error: 0 };
  const sorted = [...findings].sort((a, b) => {
    const s = impactOrder.indexOf(a.severity) - impactOrder.indexOf(b.severity);
    if (s !== 0) return s;
    return (categoryImpact[a.category] ?? 9) - (categoryImpact[b.category] ?? 9);
  });
  report.score = score;
  report.counts = { critical, high, medium, low, total: findings.length };
  report.topBugs = sorted.slice(0, 10).map((f, i) => ({
    rank: i + 1,
    severity: f.severity,
    surface: f.surface,
    category: f.category,
    message: f.message,
  }));

  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    score: report.score,
    counts: report.counts,
    topBugs: report.topBugs,
    surfaces: surfaces.map((s) => ({ id: s.id, file: s.file, notes: s.notes?.title || s.name })),
    out: OUT,
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
