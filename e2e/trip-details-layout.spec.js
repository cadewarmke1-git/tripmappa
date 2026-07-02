import { expect, test } from "@playwright/test";
import { reachTripDetailsStep, startPlanFlow } from "./helpers/planFlowHelpers.js";

async function reachTripDetails(page) {
  await startPlanFlow(page);
  await reachTripDetailsStep(page);
}

function boxAboveDock(box, dockBox) {
  if (!box || !dockBox) return false;
  return box.y + box.height <= dockBox.y + 2;
}

function boxWithin(box, containerBox) {
  if (!box || !containerBox) return false;
  return (
    box.y >= containerBox.y - 2
    && box.x >= containerBox.x - 2
    && box.y + box.height <= containerBox.y + containerBox.height + 2
    && box.x + box.width <= containerBox.x + containerBox.width + 2
  );
}

test.describe("trip details layout", () => {
  for (const size of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
    test(`food, budget, more options, and continue visible at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await reachTripDetails(page);
      const dock = page.locator(".plan-flow-action-dock");
      const dockBox = await dock.boundingBox();
      expect(dockBox).toBeTruthy();

      const food = page.locator(".question-section-label", { hasText: "Food" }).first();
      const budget = page.locator(".question-section-label", { hasText: "Budget" }).first();
      const more = page.locator(".question-more-options-label").first();
      const continueBtn = page.locator(".plan-flow-dock-continue").first();
      await expect(food).toBeVisible();
      await expect(budget).toBeVisible();
      await expect(more).toBeVisible();
      await expect(dock).toBeVisible();
      await expect(continueBtn).toBeVisible();

      for (const loc of [food, budget, more]) {
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        expect(boxAboveDock(box, dockBox)).toBe(true);
      }
      const continueBox = await continueBtn.boundingBox();
      expect(boxWithin(continueBox, dockBox)).toBe(true);
    });
  }

  test("food and budget pills receive clicks (not intercepted by footer)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await reachTripDetails(page);

    const glutenBtn = page.locator(".plan-option-card").filter({
      has: page.locator(".plan-option-card-label", { hasText: "Gluten Free", exact: true }),
    }).first();
    await expect(glutenBtn).toBeVisible();
    await expect(glutenBtn).toBeEnabled({ timeout: 10_000 });
    await glutenBtn.scrollIntoViewIfNeeded();
    const btnBox = await glutenBtn.boundingBox();
    expect(btnBox).toBeTruthy();

    const hitTarget = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const card = el?.closest?.(".plan-option-card");
      return card
        ? { className: card.className, tag: card.tagName }
        : el
          ? { tag: el.tagName, className: el.className, text: (el.textContent || "").trim().slice(0, 40) }
          : null;
    }, { x: btnBox.x + btnBox.width / 2, y: btnBox.y + btnBox.height / 2 });

    expect(hitTarget?.className || "").toMatch(/plan-option-card/);

    await glutenBtn.click();
    await expect(glutenBtn).toHaveClass(/is-selected/);

    const budgetBtn = page.locator(".plan-option-card").filter({
      has: page.locator(".plan-option-card-label", { hasText: "$200 to $500", exact: true }),
    }).first();
    await expect(budgetBtn).toBeEnabled({ timeout: 10_000 });
    await budgetBtn.scrollIntoViewIfNeeded();
    const budgetBox = await budgetBtn.boundingBox();
    expect(budgetBox).toBeTruthy();

    const dockBox = await page.locator(".plan-flow-action-dock").boundingBox();
    expect(budgetBox.y + budgetBox.height).toBeLessThanOrEqual((dockBox?.y ?? Infinity) + 2);

    const budgetHit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      const card = el?.closest?.(".plan-option-card");
      return card ? card.className : (el?.className ?? null);
    }, { x: budgetBox.x + budgetBox.width / 2, y: budgetBox.y + budgetBox.height / 2 });

    expect(budgetHit || "").toMatch(/plan-option-card/);
    await budgetBtn.click();
    await expect(budgetBtn).toHaveClass(/is-selected/);
  });
});
