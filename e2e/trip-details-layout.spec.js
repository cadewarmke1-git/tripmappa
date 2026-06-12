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

  test("food and budget pills receive clicks (not intercepted by footer)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await reachTripDetails(page);

    const glutenBtn = page.getByRole("button", { name: "Gluten Free", exact: true });
    await expect(glutenBtn).toBeVisible();
    await expect(glutenBtn).toBeEnabled({ timeout: 10_000 });
    const btnBox = await glutenBtn.boundingBox();
    expect(btnBox).toBeTruthy();

    const hitTarget = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el
        ? { tag: el.tagName, className: el.className, text: (el.textContent || "").trim().slice(0, 40) }
        : null;
    }, { x: btnBox.x + btnBox.width / 2, y: btnBox.y + btnBox.height / 2 });

    expect(hitTarget?.className || "").toMatch(/qr-btn/);

    await glutenBtn.click();
    await expect(glutenBtn).toHaveClass(/qr-selected/);

    const budgetBtn = page.getByRole("button", { name: "$200 to $500", exact: true });
    await expect(budgetBtn).toBeEnabled({ timeout: 10_000 });
    const budgetBox = await budgetBtn.boundingBox();
    expect(budgetBox).toBeTruthy();

    const budgetHit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.className : null;
    }, { x: budgetBox.x + budgetBox.width / 2, y: budgetBox.y + budgetBox.height / 2 });

    expect(budgetHit || "").toMatch(/qr-btn/);
    await budgetBtn.click();
    await expect(budgetBtn).toHaveClass(/qr-selected/);
  });
});
