/**
 * TripMappa full UI audit — desktop 1280x800 + mobile 375x812.
 * Report only. Run: node scripts/ui-audit.mjs
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  closeAutocomplete,
  finishTripDetails,
  pickPlanOption,
  skipOptionalSteps,
  waitPlanStepReady,
} from "../e2e/helpers/planFlowHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4173";
const OUT_DIR = path.join(ROOT, "test-results", "ui-audit");
const AUTH = path.join(ROOT, "e2e", ".auth", "user.json");

const VIEWPORTS = [
  { id: "desktop", width: 1280, height: 800, isMobile: false, hasTouch: false },
  { id: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
];

function severityRank(s) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s] ?? 9;
}

function relLum(r, g, b) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(fg, bg) {
  const L1 = relLum(...fg);
  const L2 = relLum(...bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(str) {
  if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") return null;
  const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m) return null;
  const a = m[4] == null ? 1 : Number(m[4]);
  if (a < 0.15) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

function blend(fg, bg) {
  const a = fg[3] ?? 1;
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
  ];
}

async function dismissOverlays(page) {
  for (let i = 0; i < 3; i++) {
    const confirm = page.locator(".confirm-dialog-overlay");
    if (await confirm.isVisible({ timeout: 300 }).catch(() => false)) {
      await confirm.locator(".confirm-dialog-cancel").first().click().catch(() => {});
      await page.waitForTimeout(200);
    }
    const draft = page.locator(".hero-draft-resume-dismiss");
    if (await draft.isVisible({ timeout: 200 }).catch(() => false)) {
      await draft.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    const close = page.locator(".modal-close-btn, .auth-modal .modal-close-btn").first();
    // don't auto-close auth during auth screens
  }
}

async function openProfileMenu(page) {
  const trigger = page.locator(".profile-card-trigger").first();
  if (await trigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await trigger.click();
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function auditScreen(page, screen, viewportId) {
  const findings = await page.evaluate(
    ({ screen, viewportId }) => {
      const out = [];
      const push = (severity, issue, detail, el) => {
        const r = el?.getBoundingClientRect?.();
        out.push({
          screen,
          viewport: viewportId,
          severity,
          issue,
          detail,
          tag: el?.tagName?.toLowerCase?.() || null,
          className: (el?.className && String(el.className).slice?.(0, 120)) || null,
          text: (el?.innerText || el?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80) || null,
          rect: r
            ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
            : null,
        });
      };

      const parseRgb = (str) => {
        if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") return null;
        const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (!m) return null;
        const a = m[4] == null ? 1 : Number(m[4]);
        if (a < 0.12) return null;
        return [Number(m[1]), Number(m[2]), Number(m[3]), a];
      };
      const relLum = (r, g, b) => {
        const f = (c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const contrast = (fg, bg) => {
        const L1 = relLum(...fg);
        const L2 = relLum(...bg);
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      };
      const blend = (fg, bg) => {
        const a = fg[3] ?? 1;
        return [
          Math.round(fg[0] * a + bg[0] * (1 - a)),
          Math.round(fg[1] * a + bg[1] * (1 - a)),
          Math.round(fg[2] * a + bg[2] * (1 - a)),
        ];
      };
      const effectiveBg = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const bg = parseRgb(getComputedStyle(n).backgroundColor);
          if (bg && (bg[3] ?? 1) >= 0.85) return [bg[0], bg[1], bg[2]];
          if (bg && (bg[3] ?? 1) >= 0.3) {
            const parent = n.parentElement ? effectiveBg(n.parentElement) : [13, 10, 26];
            return blend(bg, parent);
          }
          n = n.parentElement;
        }
        const bodyBg = parseRgb(getComputedStyle(document.body).backgroundColor);
        return bodyBg ? [bodyBg[0], bodyBg[1], bodyBg[2]] : [13, 10, 26];
      };

      const isVisible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
        return true;
      };

      const interactiveSel = [
        "a[href]",
        "button",
        "input:not([type=hidden])",
        "select",
        "textarea",
        "[role=button]",
        "[role=link]",
        "[role=tab]",
        "[role=menuitem]",
        ".plan-option-card",
        ".plan-choice-row",
        ".qr-btn",
        ".hero-go-btn",
        ".profile-card-trigger",
        ".nav-btn",
        ".app-nav-mode-btn",
      ].join(",");

      const interactives = [...document.querySelectorAll(interactiveSel)].filter(isVisible);
      const seen = new Set();

      for (const el of interactives) {
        if (seen.has(el)) continue;
        seen.add(el);
        const r = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute("role");
        const type = (el.getAttribute("type") || "").toLowerCase();
        const cs = getComputedStyle(el);
        const isInput = tag === "input" || tag === "textarea" || tag === "select";
        const isBtn =
          tag === "button" ||
          role === "button" ||
          type === "submit" ||
          type === "button" ||
          el.classList.contains("hero-go-btn") ||
          el.classList.contains("btn-generate") ||
          el.classList.contains("qr-btn") ||
          el.classList.contains("plan-option-card") ||
          el.classList.contains("plan-choice-row") ||
          el.classList.contains("nav-btn") ||
          el.classList.contains("app-nav-mode-btn") ||
          el.classList.contains("auth-modal-submit") ||
          el.classList.contains("auth-modal-alt-btn") ||
          el.classList.contains("auth-social-btn");

        // Tap / button / input size
        if (isInput) {
          if (r.height < 44) {
            push("high", "input-height", `Input height ${Math.round(r.height)}px < 44px`, el);
          }
        } else if (isBtn || tag === "a") {
          const minDim = Math.min(r.width, r.height);
          // Icon-only / close buttons: check both dimensions
          if (r.height < 44 || (r.width < 44 && r.height < 44)) {
            push(
              r.height < 36 || r.width < 36 ? "critical" : "high",
              "tap-target",
              `Tap target ${Math.round(r.width)}×${Math.round(r.height)}px < 44×44`,
              el,
            );
          } else if (isBtn && r.height < 44) {
            push("high", "button-height", `Button height ${Math.round(r.height)}px < 44px`, el);
          }
        }

        // Font size
        const fs = parseFloat(cs.fontSize) || 0;
        const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim();
        const looksLabel =
          el.classList.contains("auth-field-label") ||
          el.classList.contains("hero-input-label") ||
          /label/i.test(el.className) ||
          tag === "label";
        if (text && fs > 0) {
          if (looksLabel && fs < 11) {
            push("medium", "font-size-label", `Label font ${fs}px < 11px`, el);
          } else if (!looksLabel && !isInput && fs < 14 && text.length > 2) {
            // small chrome (badges) → medium; primary buttons → high
            push(isBtn ? "high" : "medium", "font-size-body", `Text font ${fs}px < 14px`, el);
          }
        }

        // Contrast (text-bearing interactives)
        if (text && fs >= 10) {
          const color = parseRgb(cs.color);
          if (color) {
            const bg = effectiveBg(el);
            const fg = color[3] < 1 ? blend(color, bg) : [color[0], color[1], color[2]];
            const ratio = contrast(fg, bg);
            if (ratio < 4.5) {
              push(
                ratio < 3 ? "critical" : "high",
                "contrast",
                `Contrast ${ratio.toFixed(2)}:1 < 4.5:1 (fg rgb(${fg}) on bg rgb(${bg}))`,
                el,
              );
            }
          }
        }

        // Covered by another element (z-index / overlay)
        const cx = r.left + Math.min(r.width / 2, 20);
        const cy = r.top + Math.min(r.height / 2, 20);
        if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
          const top = document.elementFromPoint(cx, cy);
          if (top && top !== el && !el.contains(top) && !top.contains(el)) {
            // ignore pac-container / tooltips
            const topCls = String(top.className || "");
            if (!/pac-container|pac-item/.test(topCls)) {
              push(
                "high",
                "z-index-cover",
                `Covered by <${top.tagName.toLowerCase()} class="${topCls.slice(0, 60)}">`,
                el,
              );
            }
          }
        }
      }

      // Labels / body text font sizes (non-interactive)
      for (const el of document.querySelectorAll("p, span, label, li, h1, h2, h3, h4, .auth-modal-sub, .auth-modal-footer, .hero-sub, .hero-input-label, .auth-field-label")) {
        if (!isVisible(el)) continue;
        if (el.closest("button, a, input")) continue;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize) || 0;
        const text = (el.innerText || "").trim();
        if (!text || fs <= 0) continue;
        const looksLabel =
          el.tagName === "LABEL" ||
          el.classList.contains("auth-field-label") ||
          el.classList.contains("hero-input-label") ||
          /label|eyebrow|kicker|badge/i.test(el.className);
        if (looksLabel && fs < 11) {
          push("medium", "font-size-label", `Label font ${fs}px < 11px`, el);
        } else if (!looksLabel && !/^H[1-4]$/.test(el.tagName) && fs < 14 && text.length > 8) {
          push("medium", "font-size-body", `Body font ${fs}px < 14px`, el);
        }

        const color = parseRgb(cs.color);
        if (color && text.length > 4 && fs >= 11) {
          const bg = effectiveBg(el);
          const fg = color[3] < 1 ? blend(color, bg) : [color[0], color[1], color[2]];
          const ratio = contrast(fg, bg);
          if (ratio < 4.5) {
            push(
              ratio < 3 ? "critical" : "high",
              "contrast",
              `Contrast ${ratio.toFixed(2)}:1 < 4.5:1`,
              el,
            );
          }
        }
      }

      // Overflow
      for (const el of document.querySelectorAll("p, span, a, button, h1, h2, h3, label, .auth-modal-footer, .auth-modal-sub, .hero-title, .plan-option-card-label")) {
        if (!isVisible(el)) continue;
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 4) {
          const cs = getComputedStyle(el);
          if (cs.overflow === "hidden" || cs.textOverflow === "ellipsis" || el.scrollWidth > el.clientWidth + 2) {
            push(
              "medium",
              "overflow",
              `Overflow scroll=${Math.round(el.scrollWidth)}×${Math.round(el.scrollHeight)} client=${Math.round(el.clientWidth)}×${Math.round(el.clientHeight)}`,
              el,
            );
          }
        }
      }

      // Modal cut-off
      for (const modal of document.querySelectorAll(".auth-modal, .modal, .upgrade-modal, .confirm-dialog")) {
        if (!isVisible(modal)) continue;
        const r = modal.getBoundingClientRect();
        if (r.top < -2 || r.left < -2 || r.bottom > innerHeight + 2 || r.right > innerWidth + 2) {
          push(
            "critical",
            "modal-cutoff",
            `Modal clipped viewport ${innerWidth}×${innerHeight}; rect top=${Math.round(r.top)} bottom=${Math.round(r.bottom)}`,
            modal,
          );
        }
        // purple-ish modal background vs #0D0A1A
        const bg = parseRgb(getComputedStyle(modal).backgroundColor);
        if (bg) {
          const [rC, gC, bC] = bg;
          const isNight = Math.abs(rC - 13) <= 8 && Math.abs(gC - 10) <= 8 && Math.abs(bC - 26) <= 12;
          const purpleish = bC > rC + 20 && bC > gC + 25 && bC > 40;
          if (purpleish && !isNight) {
            push(
              "critical",
              "modal-bg-purple",
              `Modal bg rgb(${rC},${gC},${bC}) looks purple; expected near #0D0A1A (13,10,26)`,
              modal,
            );
          } else if (!isNight && screen.includes("sign")) {
            push(
              "high",
              "modal-bg-not-night",
              `Modal bg rgb(${rC},${gC},${bC}) ≠ #0D0A1A`,
              modal,
            );
          }
        }
      }

      // Sign-in footer layout: floating period
      const footers = document.querySelectorAll(".auth-modal-footer, .auth-modal p");
      for (const el of footers) {
        if (!isVisible(el)) continue;
        const raw = el.innerText || "";
        if (/Terms of Service/i.test(raw) || /Privacy Policy/i.test(raw)) {
          const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
          if (lines.some((l) => l === "." || l === " ." || /^\.\s*$/.test(l))) {
            push("critical", "footer-period-orphan", `Orphan period line in footer: ${JSON.stringify(lines)}`, el);
          }
          // also detect period as only content of a text node line via layout
          if (/\.\s*$/.test(raw) && /Privacy Policy/i.test(raw)) {
            const html = el.innerHTML;
            // broken if period sits outside links awkwardly
            if (/>\s*\.\s*</.test(html) || /Policy<\/a>\s*\.\s*$/i.test(raw.replace(/\n/g, " "))) {
              // check visual: last line is just "."
              const rangeLines = raw.split(/\n/);
              if (rangeLines.length >= 2 && rangeLines.some((l) => l.trim() === ".")) {
                push("critical", "footer-period-orphan", `Period on own line: ${JSON.stringify(rangeLines)}`, el);
              }
            }
          }
        }
      }

      // Spacing consistency among similar option cards
      const cards = [...document.querySelectorAll(".plan-option-card, .qr-btn, .plan-choice-row")].filter(isVisible);
      if (cards.length >= 3) {
        const gaps = [];
        for (let i = 1; i < cards.length; i++) {
          const a = cards[i - 1].getBoundingClientRect();
          const b = cards[i].getBoundingClientRect();
          if (Math.abs(a.left - b.left) < 8) {
            gaps.push(Math.round(b.top - a.bottom));
          }
        }
        if (gaps.length >= 2) {
          const min = Math.min(...gaps);
          const max = Math.max(...gaps);
          if (max - min >= 12) {
            push(
              "low",
              "spacing-inconsistent",
              `Vertical gaps between similar options vary ${min}–${max}px`,
              cards[0],
            );
          }
        }
      }

      return out;
    },
    { screen, viewportId },
  );

  return findings;
}

async function screenshot(page, name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
}

async function runViewport(viewport) {
  const browser = await chromium.launch({ headless: true });
  const contextOpts = {
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    locale: "en-US",
  };
  if (viewport.isMobile) {
    contextOpts.userAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  }
  if (fs.existsSync(AUTH)) {
    contextOpts.storageState = AUTH;
  }
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();
  const all = [];
  const screensDone = [];

  const record = async (screen, extraFns = []) => {
    await page.waitForTimeout(500);
    await screenshot(page, `${viewport.id}__${screen.replace(/\s+/g, "-")}`);
    let findings = await auditScreen(page, screen, viewport.id);
    for (const fn of extraFns) {
      const more = await fn(page, screen, viewport.id);
      if (more?.length) findings = findings.concat(more);
    }
    all.push(...findings);
    screensDone.push(screen);
    console.log(`[${viewport.id}] audited: ${screen} (${findings.length} findings)`);
  };

  // —— Hero ——
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  await dismissOverlays(page);
  // force layout attribute for mobile audit when fine pointer would set web
  if (viewport.isMobile) {
    await page.evaluate(() => {
      document.documentElement.dataset.layout = "mobile";
    });
  }
  await record("hero");

  // —— Sign in modal ——
  await openProfileMenu(page);
  const signIn = page.getByRole("button", { name: /^Sign In$/i }).first();
  if (await signIn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await signIn.click();
  } else {
    // already signed in — open via evaluate / guest path: clear and reopen
    await page.evaluate(() => {
      // try click get started path
    });
    // Use signup then switch — or inject by clicking Get Started then switch
    const getStarted = page.getByRole("button", { name: /Get Started/i }).first();
    if (await getStarted.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await getStarted.click();
      await page.waitForTimeout(400);
      const switchToSignIn = page.getByRole("button", { name: /Sign [Ii]n|Already/i }).first();
      if (await switchToSignIn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await switchToSignIn.click();
      }
    }
  }
  await page.waitForSelector(".auth-modal, #signin-email", { timeout: 8_000 }).catch(() => {});
  await page.waitForTimeout(400);

  // Extra sign-in specific checks
  const signInExtra = async (p, screen, viewportId) => {
    return p.evaluate(
      ({ screen, viewportId }) => {
        const out = [];
        const modal = document.querySelector(".auth-modal");
        const footer = document.querySelector(".auth-modal-footer");
        const overlay = document.querySelector(".auth-modal-overlay, .modal-overlay");
        if (!modal) {
          out.push({
            screen,
            viewport: viewportId,
            severity: "high",
            issue: "sign-in-missing",
            detail: "Sign-in modal not found",
            tag: null,
            className: null,
            text: null,
            rect: null,
          });
          return out;
        }
        const bg = getComputedStyle(modal).backgroundColor;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const r = +m[1],
            g = +m[2],
            b = +m[3];
          const dist = Math.sqrt((r - 13) ** 2 + (g - 10) ** 2 + (b - 26) ** 2);
          const purpleish = b > r + 15 && b > g + 20;
          if (dist > 25 || purpleish) {
            out.push({
              screen,
              viewport: viewportId,
              severity: "critical",
              issue: "signin-modal-bg",
              detail: `Sign-in modal background ${bg} (rgb ${r},${g},${b}); expected #0D0A1A ≈ rgb(13,10,26); purpleish=${purpleish}`,
              tag: "div",
              className: modal.className,
              text: null,
              rect: (() => {
                const x = modal.getBoundingClientRect();
                return { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height) };
              })(),
            });
          }
        }
        if (footer) {
          const raw = footer.innerText || "";
          const lines = raw.split("\n").map((l) => l.trim());
          if (lines.some((l) => l === ".")) {
            out.push({
              screen,
              viewport: viewportId,
              severity: "critical",
              issue: "signin-footer-period",
              detail: `Terms/Privacy footer has orphan period line: ${JSON.stringify(lines)}`,
              tag: "p",
              className: footer.className,
              text: raw.slice(0, 120),
              rect: (() => {
                const x = footer.getBoundingClientRect();
                return { x: Math.round(x.x), y: Math.round(x.y), w: Math.round(x.width), h: Math.round(x.height) };
              })(),
            });
          }
          // layout break: period after links wrapping alone
          const html = footer.innerHTML;
          out.push({
            screen,
            viewport: viewportId,
            severity: "low",
            issue: "signin-footer-html",
            detail: `Footer HTML snapshot: ${html.slice(0, 240).replace(/\s+/g, " ")}`,
            tag: "p",
            className: footer.className,
            text: raw.replace(/\s+/g, " ").slice(0, 120),
            rect: null,
          });
        }
        if (overlay) {
          const obg = getComputedStyle(overlay).backgroundColor;
          out.push({
            screen,
            viewport: viewportId,
            severity: "low",
            issue: "signin-overlay-bg",
            detail: `Overlay background: ${obg}`,
            tag: "div",
            className: String(overlay.className).slice(0, 80),
            text: null,
            rect: null,
          });
        }
        return out;
      },
      { screen, viewportId },
    );
  };

  if (await page.locator(".auth-modal, #signin-email").first().isVisible().catch(() => false)) {
    await record("sign-in-modal", [signInExtra]);
  } else {
    console.log(`[${viewport.id}] skip sign-in-modal (not visible — likely already authenticated)`);
  }

  // —— Sign up modal ——
  const switchSignup = page.getByRole("button", { name: /Create an account|Sign [Uu]p|Get started/i }).first();
  if (await switchSignup.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await switchSignup.click();
    await page.waitForTimeout(500);
    await record("sign-up-modal");
  } else {
    await page.locator(".modal-close-btn").first().click({ timeout: 2_000 }).catch(() => {});
    await openProfileMenu(page);
    const getStarted = page.getByRole("button", { name: /Get Started/i }).first();
    if (await getStarted.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await getStarted.click();
      await page.waitForTimeout(500);
      await record("sign-up-modal");
    } else {
      console.log(`[${viewport.id}] skip sign-up-modal`);
    }
  }
  await page.locator(".modal-close-btn").first().click({ timeout: 2_000 }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  // —— Pricing ——
  await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(800);
  await record("pricing");

  // —— Hero → plan flow ——
  await page.goto(`${BASE}/?skyHour=12&skyTest=0`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  if (viewport.isMobile) {
    await page.evaluate(() => {
      document.documentElement.dataset.layout = "mobile";
    });
  }
  await page.waitForTimeout(800);
  await dismissOverlays(page);

  try {
    await page.locator(".hero-input").first().fill("Dallas, TX");
    await closeAutocomplete(page);
    await page.locator(".hero-input").nth(1).fill("Austin, TX");
    await closeAutocomplete(page);
    const goBtn = page.locator(".hero-go-btn");
    await goBtn.click({ timeout: 15_000 });
    // may hit auth gate
    const authGate = page.locator(".auth-modal");
    if (await authGate.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await record("auth-gate-on-launch");
      await page.locator(".modal-close-btn").first().click().catch(() => {});
      // If we have storage state, relaunch after close shouldn't gate — try again
      await page.waitForTimeout(300);
      if (await goBtn.isEnabled().catch(() => false)) {
        await goBtn.click();
      }
    }
    await page.waitForSelector(".float-card--plan-flow", { timeout: 45_000 });
    await waitPlanStepReady(page);
    await record("plan-flow-vehicle");

    await pickPlanOption(page, "Car");
    await waitPlanStepReady(page);
    await record("plan-flow-after-vehicle");

    // Advance through remaining steps, auditing each distinct title
    for (let step = 0; step < 12; step++) {
      const title = await page
        .locator(".question-page-title, .plan-flow-question-title, .chat-title")
        .first()
        .innerText()
        .catch(() => `step-${step}`);
      const slug = `plan-flow-${String(title).slice(0, 40).replace(/[^\w]+/g, "-").toLowerCase()}`;
      if (!screensDone.includes(slug)) {
        await record(slug);
      }

      if (await page.locator(".btn-generate-trip").isVisible({ timeout: 800 }).catch(() => false)) {
        break;
      }

      // Try common advances
      if (await pickPlanOption(page, "Gas")) {
        await waitPlanStepReady(page);
        continue;
      }
      if (await pickPlanOption(page, "Just me")) {
        await waitPlanStepReady(page);
        continue;
      }
      if (await pickPlanOption(page, "Just one stop")) {
        await waitPlanStepReady(page);
        continue;
      }
      if (await pickPlanOption(page, "A few (2-3)")) {
        await waitPlanStepReady(page);
        continue;
      }
      // scenic / overnight skips
      await skipOptionalSteps(page);
      if (await page.locator(".question-page-title, .plan-flow-question-title").filter({ hasText: /details/i }).isVisible({ timeout: 2_000 }).catch(() => false)) {
        await finishTripDetails(page);
        await record("plan-flow-ready");
        break;
      }
      const cont = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
      if (await cont.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await cont.click();
        await waitPlanStepReady(page);
        continue;
      }
      const skip = page.locator(".plan-flow-dock-skip, .convo-nav-btn-skip").first();
      if (await skip.isVisible({ timeout: 800 }).catch(() => false)) {
        await skip.click();
        await waitPlanStepReady(page);
        continue;
      }
      // pick first visible option card
      const firstCard = page.locator(".plan-option-card, .qr-btn, .plan-choice-row").first();
      if (await firstCard.isVisible({ timeout: 800 }).catch(() => false)) {
        await firstCard.click();
        await waitPlanStepReady(page);
        continue;
      }
      break;
    }
  } catch (err) {
    console.log(`[${viewport.id}] plan-flow error: ${err.message}`);
    all.push({
      screen: "plan-flow",
      viewport: viewport.id,
      severity: "high",
      issue: "navigation-error",
      detail: err.message,
      tag: null,
      className: null,
      text: null,
      rect: null,
    });
  }

  // —— Results (if generate available — may be slow; try with timeout) ——
  try {
    const gen = page.locator(".btn-generate-trip").first();
    if (await gen.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await gen.click();
      // auth gate again?
      if (await page.locator(".auth-modal").isVisible({ timeout: 2_000 }).catch(() => false)) {
        await record("auth-gate-on-generate");
      } else {
        await page.waitForSelector(".trip-results-panel, .road-stop-card, .results-fullscreen", {
          timeout: 180_000,
        });
        await page.waitForTimeout(1500);
        await record("results");

        // Map view toggle
        const mapTab = page.getByRole("button", { name: /map/i }).first();
        if (await mapTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await mapTab.click();
          await page.waitForTimeout(1200);
          await record("map-view");
        }
      }
    } else {
      console.log(`[${viewport.id}] skip results (generate not visible)`);
    }
  } catch (err) {
    console.log(`[${viewport.id}] results error: ${err.message}`);
    all.push({
      screen: "results",
      viewport: viewport.id,
      severity: "medium",
      issue: "navigation-error",
      detail: err.message,
      tag: null,
      className: null,
      text: null,
      rect: null,
    });
  }

  // —— Navigate tab ——
  try {
    await page.goto(`${BASE}/?skyHour=12`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(600);
    const navMode = page.locator(".app-nav-mode-btn", { hasText: /Navigate/i }).first();
    if (await navMode.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await navMode.click();
      await page.waitForTimeout(1000);
      await record("navigate-tab");
    } else {
      console.log(`[${viewport.id}] skip navigate-tab`);
    }
  } catch (err) {
    console.log(`[${viewport.id}] navigate error: ${err.message}`);
  }

  // —— Profile ——
  try {
    await openProfileMenu(page);
    const profile = page.getByRole("button", { name: /Profile|Account|My profile/i }).first();
    const profileLink = page.locator(".profile-card-nav-link", { hasText: /Profile|Account/i }).first();
    if (await profileLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await profileLink.click();
      await page.waitForTimeout(1000);
      await record("profile");
    } else if (await profile.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await profile.click();
      await page.waitForTimeout(1000);
      await record("profile");
    } else {
      await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(800);
      if (await page.locator(".profile-view-wrap, .user-preferences-page, .profile-page").first().isVisible().catch(() => false)) {
        await record("profile");
      } else {
        console.log(`[${viewport.id}] skip profile`);
      }
    }
  } catch (err) {
    console.log(`[${viewport.id}] profile error: ${err.message}`);
  }

  // —— Share view (panel or live share route) ——
  try {
    await page.goto(`${BASE}/?skyHour=12`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(500);
    await openProfileMenu(page);
    const share = page.locator(".profile-card-nav-link", { hasText: /Share/i }).first();
    if (await share.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await share.click();
      await page.waitForTimeout(1000);
      await record("share-view");
    } else {
      // try share panel route patterns
      await page.goto(`${BASE}/share`, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(800);
      await record("share-view");
    }
  } catch (err) {
    console.log(`[${viewport.id}] share error: ${err.message}`);
  }

  await browser.close();
  return { viewport: viewport.id, findings: all, screens: screensDone };
}

function dedupe(findings) {
  const map = new Map();
  for (const f of findings) {
    const key = [f.viewport, f.screen, f.issue, f.detail?.slice(0, 80), f.className, f.text].join("|");
    if (!map.has(key)) map.set(key, f);
  }
  return [...map.values()];
}

function groupReport(findings) {
  const byScreen = {};
  for (const f of findings) {
    const k = `${f.screen} @ ${f.viewport}`;
    if (!byScreen[k]) byScreen[k] = [];
    byScreen[k].push(f);
  }
  for (const k of Object.keys(byScreen)) {
    byScreen[k].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  }
  return byScreen;
}

function top10(findings) {
  const priorityIssues = new Set([
    "signin-modal-bg",
    "signin-footer-period",
    "footer-period-orphan",
    "modal-bg-purple",
    "modal-cutoff",
    "z-index-cover",
    "contrast",
    "tap-target",
    "button-height",
    "input-height",
    "auth-gate-on-launch",
  ]);
  const scored = findings
    .filter((f) => f.severity === "critical" || f.severity === "high" || priorityIssues.has(f.issue))
    .filter((f) => f.issue !== "signin-footer-html" && f.issue !== "signin-overlay-bg")
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const out = [];
  const seen = new Set();
  for (const f of scored) {
    const k = `${f.issue}|${f.screen}|${f.detail?.slice(0, 60)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
    if (out.length >= 10) break;
  }
  return out;
}

const results = [];
for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.id} ${vp.width}x${vp.height} ===`);
  results.push(await runViewport(vp));
}

const merged = dedupe(results.flatMap((r) => r.findings));
const grouped = groupReport(merged);
const top = top10(merged);

const summary = {
  base: BASE,
  generatedAt: new Date().toISOString(),
  screensPerViewport: Object.fromEntries(results.map((r) => [r.viewport, r.screens])),
  counts: {
    total: merged.length,
    critical: merged.filter((f) => f.severity === "critical").length,
    high: merged.filter((f) => f.severity === "high").length,
    medium: merged.filter((f) => f.severity === "medium").length,
    low: merged.filter((f) => f.severity === "low").length,
  },
  top10: top,
  byScreen: grouped,
  all: merged,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(summary, null, 2));

// Markdown report
let md = `# TripMappa UI Audit Report\n\n`;
md += `Base: ${BASE}  \nGenerated: ${summary.generatedAt}\n\n`;
md += `## Counts\n\n`;
md += `| Severity | Count |\n|---|---|\n`;
md += `| Critical | ${summary.counts.critical} |\n`;
md += `| High | ${summary.counts.high} |\n`;
md += `| Medium | ${summary.counts.medium} |\n`;
md += `| Low | ${summary.counts.low} |\n`;
md += `| **Total** | **${summary.counts.total}** |\n\n`;

md += `## Screens covered\n\n`;
for (const [vp, screens] of Object.entries(summary.screensPerViewport)) {
  md += `- **${vp}**: ${screens.join(", ")}\n`;
}
md += `\n## Top 10 critical for Friday demo\n\n`;
top.forEach((f, i) => {
  md += `${i + 1}. **[${f.severity.toUpperCase()}]** ${f.screen} @ ${f.viewport} — \`${f.issue}\`: ${f.detail}`;
  if (f.text) md += ` (“${f.text}”)`;
  md += `\n`;
});
md += `\n## Findings by screen\n\n`;
for (const [screen, items] of Object.entries(grouped)) {
  md += `### ${screen}\n\n`;
  if (!items.length) {
    md += `_No findings._\n\n`;
    continue;
  }
  for (const f of items) {
    if (f.issue === "signin-footer-html" || f.issue === "signin-overlay-bg") continue;
    md += `- **${f.severity}** \`${f.issue}\`: ${f.detail}`;
    if (f.text) md += ` — “${f.text}”`;
    if (f.rect) md += ` (${f.rect.w}×${f.rect.h} at ${f.rect.x},${f.rect.y})`;
    md += `\n`;
  }
  md += `\n`;
}
fs.writeFileSync(path.join(OUT_DIR, "report.md"), md);
console.log(`\nWrote ${path.join(OUT_DIR, "report.md")}`);
console.log(JSON.stringify(summary.counts, null, 2));
console.log("\nTOP 10:");
top.forEach((f, i) => console.log(`${i + 1}. [${f.severity}] ${f.screen}@${f.viewport} ${f.issue}: ${f.detail}`));
