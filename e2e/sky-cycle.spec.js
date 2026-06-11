import { expect, test } from "@playwright/test";

const PHASES = [
  { hour: 12, surface: "day", phase: "midday" },
  { hour: 18, surface: "twilight", phase: "golden_hour" },
  { hour: 22, surface: "night", phase: "night" },
];

test.describe("sky cycle surface theme", () => {
  for (const { hour, surface, phase } of PHASES) {
    test(`html tokens at ${hour}:00 — ${surface} / ${phase}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/?skyHour=${hour}&skyTest=0`);
      await page.waitForTimeout(1200);
      const attrs = await page.evaluate(() => ({
        surface: document.documentElement.dataset.surfaceTheme,
        skyPhase: document.documentElement.dataset.skyPhase,
        base: getComputedStyle(document.documentElement).getPropertyValue("--color-base").trim(),
      }));
      expect(attrs.surface).toBe(surface);
      expect(attrs.skyPhase).toBe(phase);
      if (surface === "day") {
        expect(attrs.base.toLowerCase()).toMatch(/f5e6c8|#f5e6c8/);
      }
      if (surface === "night") {
        expect(attrs.base.toLowerCase()).toMatch(/0d0a1a|#0d0a1a/);
      }
    });
  }
});
