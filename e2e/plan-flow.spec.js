import { expect, test } from "@playwright/test";

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

async function startPlanFlow(page) {
  await page.goto("/?skyHour=12&skyTest=0");
  await page.waitForTimeout(1000);
  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-go-btn").click();
  await expect(page.locator(".float-card--plan-flow")).toBeVisible({ timeout: 45_000 });
}

test.describe("plan flow UX", () => {
  test("desktop panel is ~50% width with 44px tap targets", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await startPlanFlow(page);
    const panel = page.locator(".float-card--plan-flow");
    const box = await panel.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(500);
    const startOver = page.locator(".plan-flow-start-over");
    const sb = await startOver.boundingBox();
    expect(sb?.height ?? 0).toBeGreaterThanOrEqual(40);
  });

  test("mobile uses full-width panel", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startPlanFlow(page);
    const panel = page.locator(".float-card--plan-flow");
    const box = await panel.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(360);
  });

  test("vehicle step shows readable progress phases", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await startPlanFlow(page);
    const phase = page.locator(".question-progress-phase").first();
    await expect(phase).toBeVisible();
    const fs = await phase.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThanOrEqual(12);
  });
});
