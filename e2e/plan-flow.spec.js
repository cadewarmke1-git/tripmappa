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

  test("desktop answer sidebar uses compact label/value layout at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await startPlanFlow(page);
    await page.getByRole("button", { name: "Car", exact: true }).click();
    const sidebar = page.locator(".plan-flow-answer-sidebar");
    await expect(sidebar).toBeVisible();
    const label = sidebar.locator(".plan-flow-answer-sidebar-label").first();
    const value = sidebar.locator(".plan-flow-answer-sidebar-value").first();
    await expect(label).toHaveText("VEHICLE");
    await expect(value).toHaveText("Car");
    const styles = await sidebar.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        width: parseFloat(cs.width),
        borderLeftWidth: cs.borderLeftWidth,
        borderLeftColor: cs.borderLeftColor,
      };
    });
    expect(styles.width).toBeGreaterThanOrEqual(88);
    expect(styles.width).toBeLessThanOrEqual(92);
    expect(parseFloat(styles.borderLeftWidth)).toBeGreaterThan(0);
    const labelFs = await label.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const valueFs = await value.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(labelFs).toBe(9);
    expect(valueFs).toBe(10);
    const labelColor = await label.evaluate(el => getComputedStyle(el).color);
    const valueColor = await value.evaluate(el => getComputedStyle(el).color);
    const accentColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
    const secondaryColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-secondary").trim());
    expect(labelColor).toBeTruthy();
    expect(valueColor).toBeTruthy();
    if (secondaryColor) expect(labelColor).not.toBe(valueColor);
    if (accentColor) expect(valueColor).toBeTruthy();
    const mainWidth = await page.locator(".plan-flow-main").evaluate(el => el.getBoundingClientRect().width);
    const bodyWidth = await page.locator(".plan-flow-body").evaluate(el => el.getBoundingClientRect().width);
    expect(mainWidth).toBeGreaterThanOrEqual(bodyWidth - 95);
    const bodyLayout = await page.locator(".plan-flow-body").evaluate(el => getComputedStyle(el).flexDirection);
    expect(bodyLayout).toBe("row");
  });

  test("mobile hides sidebar and shows history pills in route card at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startPlanFlow(page);
    await page.getByRole("button", { name: "Car", exact: true }).click();
    const sidebar = page.locator(".plan-flow-answer-sidebar");
    await expect(sidebar).toBeHidden();
    const historyChips = page.locator(".plan-route-card-chips--history .plan-route-card-chip");
    await expect(historyChips).toHaveCount(1);
    await expect(historyChips.first()).toHaveText("Car");
    const defaultChips = page.locator(".plan-route-card-chips--default");
    await expect(defaultChips).toBeHidden();
    const sidebarDisplay = await sidebar.evaluate(el => getComputedStyle(el).display);
    expect(sidebarDisplay).toBe("none");
  });
});
