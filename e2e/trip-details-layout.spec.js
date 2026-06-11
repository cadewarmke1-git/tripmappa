import { expect, test } from "@playwright/test";

async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

async function reachTripDetails(page) {
  await page.goto("/?skyHour=12&skyTest=0");
  await page.waitForTimeout(1000);
  await page.locator(".hero-input").first().fill("Dallas, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-input").nth(1).fill("Austin, TX");
  await closeAutocomplete(page);
  await page.locator(".hero-go-btn").click();
  await expect(page.locator(".float-card--plan-flow")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Car", exact: true }).click();
  await page.getByRole("button", { name: "Gasoline", exact: true }).click();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Just me", exact: true }).click();
  await page.waitForTimeout(500);
  const scenic = page.getByRole("button", { name: "Scenic route" });
  if (await scenic.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await page.locator(".plan-flow-actions .convo-nav-btn-skip").click();
    await page.waitForTimeout(500);
  }
  const straightThrough = page.getByRole("button", { name: /Drive straight through/i });
  if (await straightThrough.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await straightThrough.first().click();
  }
  await expect(page.locator(".question-page-title")).toHaveText("A few more details", { timeout: 20_000 });
}

function boxVisibleInPanel(box, panelBox) {
  if (!box || !panelBox) return false;
  return box.y >= panelBox.y && box.y + box.height <= panelBox.y + panelBox.height + 2;
}

test.describe("trip details layout", () => {
  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    test(`food, budget, more options, and continue visible at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await reachTripDetails(page);
      const panel = page.locator(".float-card--plan-flow");
      const panelBox = await panel.boundingBox();
      expect(panelBox).toBeTruthy();
      const food = page.locator(".question-section-label", { hasText: "Food" }).first();
      const budget = page.locator(".question-section-label", { hasText: "Budget" }).first();
      const more = page.locator(".question-more-options-label").first();
      const continueBtn = page.locator(".plan-flow-actions .btn-generate-inline").first();
      await expect(food).toBeVisible();
      await expect(budget).toBeVisible();
      await expect(more).toBeVisible();
      await expect(continueBtn).toBeVisible();
      for (const loc of [food, budget, more, continueBtn]) {
        const box = await loc.boundingBox();
        expect(boxVisibleInPanel(box, panelBox)).toBe(true);
      }
    });
  }
});
