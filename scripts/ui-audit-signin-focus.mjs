import { chromium } from "@playwright/test";
import fs from "fs";

const OUT = "test-results/ui-audit";
fs.mkdirSync(OUT, { recursive: true });

function parseRgb(str) {
  const m = String(str).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])];
}

async function auditSignIn(vp) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: "en-US",
    ...(vp.mobile
      ? {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        }
      : {}),
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/?skyHour=12&skyTest=0", { waitUntil: "domcontentloaded" });
  if (vp.mobile) {
    await page.evaluate(() => {
      document.documentElement.dataset.layout = "mobile";
    });
  }
  await page.waitForTimeout(1000);
  await page.locator(".profile-card-trigger").first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Sign In$/i }).click();
  await page.waitForSelector(".auth-modal", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/focus-signin-${vp.id}.png` });

  const data = await page.evaluate(() => {
    const modal = document.querySelector(".auth-modal");
    const footers = [...document.querySelectorAll(".auth-modal-footer")];
    const cs = getComputedStyle(modal);
    const mr = modal.getBoundingClientRect();

    const inputs = [...document.querySelectorAll(".auth-modal .auth-field-input")].map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        id: el.id,
        w: Math.round(r.width),
        h: Math.round(r.height),
        fs: s.fontSize,
        color: s.color,
        bg: s.backgroundColor,
      };
    });

    const buttons = [...document.querySelectorAll(".auth-modal button")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40),
        w: Math.round(r.width),
        h: Math.round(r.height),
        cls: String(el.className).slice(0, 70),
      };
    });

    const footerInfo = footers.map((footer) => {
      const raw = footer.innerText;
      const lines = raw.split("\n");
      const periodRects = [];
      const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        const idx = n.textContent.lastIndexOf(".");
        if (idx < 0) continue;
        const range = document.createRange();
        range.setStart(n, idx);
        range.setEnd(n, idx + 1);
        for (const r of range.getClientRects()) {
          periodRects.push({
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
            node: JSON.stringify(n.textContent),
          });
        }
      }
      // detect orphan period: period rect y significantly below Privacy link
      const privacy = footer.querySelector('a[href="/privacy"]');
      let orphan = false;
      if (privacy && periodRects.length) {
        const pr = privacy.getBoundingClientRect();
        orphan = periodRects.some((p) => p.y > pr.bottom + 4);
      }
      return {
        text: raw,
        lines: lines.map((l) => JSON.stringify(l)),
        html: footer.innerHTML.replace(/\s+/g, " ").slice(0, 280),
        periodRects,
        orphanPeriod: orphan,
        color: getComputedStyle(footer).color,
        fs: getComputedStyle(footer).fontSize,
      };
    });

    return {
      modalBg: cs.backgroundColor,
      modalRect: {
        top: Math.round(mr.top),
        bottom: Math.round(mr.bottom),
        h: Math.round(mr.height),
        w: Math.round(mr.width),
      },
      viewport: { w: innerWidth, h: innerHeight },
      clipped: mr.top < -2 || mr.bottom > innerHeight + 2 || mr.left < -2 || mr.right > innerWidth + 2,
      inputs,
      buttons,
      footerInfo,
    };
  });

  const rgb = parseRgb(data.modalBg);
  const dist = rgb
    ? Math.sqrt((rgb[0] - 13) ** 2 + (rgb[1] - 10) ** 2 + (rgb[2] - 26) ** 2)
    : null;
  const purpleish = rgb ? rgb[2] > rgb[0] + 15 && rgb[2] > rgb[1] + 20 : false;

  console.log(`=== ${vp.id} ===`);
  console.log(
    JSON.stringify(
      {
        ...data,
        nightDistance: dist,
        purpleish,
        expectedNight: "rgb(13,10,26)",
      },
      null,
      2,
    ),
  );
  await browser.close();
  return data;
}

await auditSignIn({ id: "desktop", w: 1280, h: 800, mobile: false });
await auditSignIn({ id: "mobile", w: 375, h: 812, mobile: true });
