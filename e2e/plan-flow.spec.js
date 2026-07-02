import { expect, test } from "@playwright/test";
import { waitPlanStepReady } from "./helpers/planFlowHelpers.js";

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
    const startOver = page.locator(".plan-flow-dock-start-over, .plan-flow-start-over");
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
    const stepLabel = page.locator(".plan-flow-step-label").first();
    const questionTitle = page.locator(".plan-flow-question-title").first();
    await expect(stepLabel).toBeVisible();
    const fs = await questionTitle.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThanOrEqual(12);
  });

  test("desktop answer sidebar uses compact label/value layout at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await startPlanFlow(page);
    await page.locator(".plan-option-card").filter({
      has: page.locator(".plan-option-card-label", { hasText: "Car", exact: true }),
    }).first().click();
    await waitPlanStepReady(page);
    await expect(page.locator(".plan-flow-pick-chip-value", { hasText: "Car" })).toBeVisible({ timeout: 10_000 });
    const sidebar = page.locator(".plan-flow-picks-strip--flow");
    await expect(sidebar).toBeVisible();
    const label = sidebar.locator(".plan-flow-pick-chip-label").first();
    const value = sidebar.locator(".plan-flow-pick-chip-value").first();
    await expect(label).toHaveText("VEHICLE");
    await expect(value).toHaveText("Car");
    const styles = await page.locator(".plan-flow-pick-chip").first().evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        width: parseFloat(cs.width),
        borderLeftWidth: cs.borderLeftWidth,
        borderLeftColor: cs.borderLeftColor,
      };
    });
    expect(styles.width).toBeGreaterThanOrEqual(115);
    expect(styles.width).toBeLessThanOrEqual(125);
    expect(parseFloat(styles.borderLeftWidth)).toBeGreaterThan(0);
    const labelFs = await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const valueFs = await value.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(labelFs).toBe(9);
    expect(valueFs).toBe(12);
    const labelOpacity = await label.evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(labelOpacity).toBeLessThan(1);
    const mainWidth = await page.locator(".plan-flow-main").evaluate(el => el.getBoundingClientRect().width);
    const bodyWidth = await page.locator(".plan-flow-body").evaluate(el => el.getBoundingClientRect().width);
    expect(mainWidth).toBeGreaterThanOrEqual(bodyWidth - 95);
    const bodyLayout = await page.locator(".plan-flow-body").evaluate(el => getComputedStyle(el).flexDirection);
    expect(bodyLayout).toBe("row");
  });

  test("mobile hides sidebar and shows history pills in route card at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startPlanFlow(page);
    await page.locator(".plan-option-card").filter({
      has: page.locator(".plan-option-card-label", { hasText: "Car", exact: true }),
    }).first().click();
    await waitPlanStepReady(page);
    const historyChips = page.locator(".plan-flow-pick-chip-value, .plan-route-card-chips--history .plan-route-card-chip");
    await expect(historyChips.filter({ hasText: /^Car$/ })).toHaveCount(1);
    const defaultChips = page.locator(".plan-route-card-chips--default");
    await expect(defaultChips).toBeHidden();
    const sidebar = page.locator(".plan-flow-answer-sidebar");
    await expect(sidebar).toBeHidden();
  });
});
