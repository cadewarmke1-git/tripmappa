import { expect, test } from "@playwright/test";

const SKY_HOURS = [
  { hour: 6, name: "sunrise" },
  { hour: 12, name: "midday" },
  { hour: 20, name: "dusk" },
];

test.describe("hero sky visuals", () => {
  for (const { hour, name } of SKY_HOURS) {
    test(`renders hero mountain scene at ${name} (${hour}:00)`, async ({ page }) => {
      await page.goto(`/?skyHour=${hour}&skyTest=0`);
      const scene = page.locator(".hero-mountain-scene");
      await expect(scene).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(800);
      await expect(scene).toHaveScreenshot(`hero-sky-${name}.png`, {
        maxDiffPixelRatio: 0.04,
      });
    });
  }

  test("hides sky test dial in production mode", async ({ page }) => {
    await page.goto("/?skyTest=0");
    await expect(page.locator(".hero-sky-test-dial")).toHaveCount(0);
  });

  test("shows sky test dial with ?skyTest=1", async ({ page }) => {
    await page.goto("/?skyTest=1");
    await expect(page.locator(".hero-sky-test-dial")).toBeVisible();
  });
});
