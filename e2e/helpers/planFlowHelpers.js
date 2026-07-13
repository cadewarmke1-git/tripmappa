import { expect } from "@playwright/test";

export async function closeAutocomplete(page) {
  await page.keyboard.press("Escape");
  await page.locator(".hero-title").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
}

export async function startPlanFlow(page, { origin = "Dallas, TX", dest = "Austin, TX" } = {}) {
  await page.goto("/?skyHour=12&skyTest=0");
  await page.waitForTimeout(1000);
  const heroCta = page.locator(".hero-plan-cta, .returning-user-action--plan").first();
  await expect(heroCta).toBeEnabled({ timeout: 90_000 });
  await heroCta.click();
  await expect(page.locator(".float-card--plan-flow")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".plan-flow-question-title")).toContainText("Where are you headed", { timeout: 15_000 });
  await page.locator("#plan-route-origin").fill(origin);
  await closeAutocomplete(page);
  await page.locator("#plan-route-dest").fill(dest);
  await closeAutocomplete(page);
  const continueBtn = page.locator(".plan-flow-dock-continue, .btn-generate-inline").first();
  await expect(continueBtn).toBeEnabled({ timeout: 15_000 });
  await continueBtn.click();
  await expect(page.locator(".plan-flow-question-title")).toContainText("How are you traveling", { timeout: 20_000 });
}

export async function pickPlanOption(page, label) {
  const card = page.locator(".plan-option-card").filter({
    has: page.locator(".plan-option-card-label", { hasText: label, exact: true }),
  }).first();
  if (await card.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await card.click();
    return true;
  }
  const row = page.locator(".plan-choice-row", { hasText: label }).first();
  if (await row.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await row.click();
    return true;
  }
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const btn = page.getByRole("button", { name: new RegExp(`^${escaped}(\\s|$|—)`, "i") }).first();
  if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return pickChoiceRow(page, label);
}

export async function pickStopCount(page) {
  if (await pickPlanOption(page, "Just one stop")) return true;
  if (await pickPlanOption(page, "A few (2-3)")) return true;
  if (await pickPlanOption(page, "Surprise me")) return true;
  return false;
}

export async function skipOptionalSteps(page) {
  const scenic = page.locator(".plan-option-card-label", { hasText: "Scenic route" }).first();
  if (await scenic.isVisible({ timeout: 4_000 }).catch(() => false)) {
    const skip = page.locator(".plan-flow-dock-skip, .plan-flow-actions .convo-nav-btn-skip").first();
    if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  }
  if (await pickPlanOption(page, "Drive straight through")) {
    await page.waitForTimeout(400);
  } else {
    const straightThrough = page.locator(".plan-choice-row", { hasText: /Drive straight through/i }).first();
    if (await straightThrough.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await straightThrough.click();
      await page.waitForTimeout(400);
    } else {
      const straightBtn = page.getByRole("button", { name: /Drive straight through/i });
      if (await straightBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await straightBtn.first().click();
        await page.waitForTimeout(400);
      }
    }
  }
  const overnight = page.getByRole("button", { name: /overnight/i });
  if (await overnight.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const skip = page.locator(".plan-flow-dock-skip, .plan-flow-actions .convo-nav-btn-skip").first();
    if (await skip.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  }
}

export async function finishTripDetails(page) {
  const skipDefaults = page.getByRole("button", { name: /Skip for now|Use defaults|Defaults are fine/i });
  if (await skipDefaults.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await skipDefaults.first().click();
    await page.waitForTimeout(400);
  }
  const continueBtn = page.locator(".plan-flow-dock-continue, .btn-generate.plan-flow-dock-continue, .plan-flow-actions .btn-generate-inline, .btn-generate-inline").first();
  if (await continueBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(400);
  }
  await expect(page.locator(".btn-generate-trip")).toBeVisible({ timeout: 25_000 });
}

export async function completeThinTransportFlow(page, vehicleLabel) {
  await pickVehicle(page, vehicleLabel);
  await waitPlanStepReady(page);
  await pickPlanOption(page, "Just me");
  await waitPlanStepReady(page);
  await expect(page.locator(".question-page-title, .plan-flow-question-title").filter({ hasText: "A few more details" })).toBeVisible({ timeout: 20_000 });
  await finishTripDetails(page);
}

async function pickChoiceRow(page, label) {
  const row = page.locator(".plan-choice-row", { hasText: label }).first();
  if (await row.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await row.click();
    return true;
  }
  const btn = page.getByRole("button", { name: label, exact: true });
  if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}

export async function waitPlanStepReady(page) {
  await expect(page.locator(".question-choices.choices-frozen")).toHaveCount(0, { timeout: 12_000 });
}

export async function reachTripDetailsStep(page) {
  await pickPlanOption(page, "Car");
  await waitPlanStepReady(page);
  await pickPlanOption(page, "Gasoline");
  await waitPlanStepReady(page);
  await pickPlanOption(page, "No");
  await waitPlanStepReady(page);
  await pickPlanOption(page, "Just me");
  await waitPlanStepReady(page);
  await pickStopCount(page);
  await waitPlanStepReady(page);
  await skipOptionalSteps(page);
  await expect(page.locator(".question-page-title, .plan-flow-question-title").filter({ hasText: "A few more details" })).toBeVisible({ timeout: 20_000 });
}

export async function completeCarFlow(page) {
  await reachTripDetailsStep(page);
  await finishTripDetails(page);
}

export async function pickVehicle(page, vehicleLabel) {
  const expander = page.getByRole("button", { name: /More vehicle types/i });
  if (await expander.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expander.click();
    await page.waitForTimeout(300);
  }
  const otherTab = page.getByRole("tab", { name: "Other" });
  if (await otherTab.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await otherTab.click();
    await page.waitForTimeout(300);
  }
  await pickPlanOption(page, vehicleLabel);
}

function encodeSse(events) {
  return events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

export function buildMockPlanTripSse({
  routeSummary = "Dallas to Austin",
  cities = ["Waco, TX"],
  stopName = "Waco Riverwalk",
  roadStops = [],
} = {}) {
  const complete = {
    route_summary: routeSummary,
    stops: [{ city: cities[0] || "Waco, TX", name: stopName, lat: 31.55, lng: -97.15 }],
    road_stops: roadStops,
    tips: ["Allow extra time near downtown exits"],
  };
  return encodeSse([
    { event: "start", data: { maxTokens: 4096, tier: "short" } },
    { event: "chunk", data: { text: JSON.stringify({ route_summary: routeSummary }) } },
    { event: "progress", data: { phase: "stops", cityNames: cities } },
    { event: "complete", data: complete },
  ]);
}

export async function installMockPlanTrip(page, options = {}) {
  const body = buildMockPlanTripSse(options);
  await page.route("**/api/plan-trip", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      body,
    });
  });
}

export async function installSlowMockPlanTrip(page, options = {}) {
  const complete = {
    route_summary: options.routeSummary || "Dallas to Austin",
    stops: [{ city: "Waco, TX", name: "Waco Stop", lat: 31.55, lng: -97.15 }],
    road_stops: [],
    tips: ["Enjoy the drive"],
  };

  const body = encodeSse([
    { event: "start", data: { maxTokens: 4096 } },
    { event: "chunk", data: { text: JSON.stringify({ route_summary: "Dallas to Austin" }) } },
    { event: "progress", data: { phase: "route", message: "Route summary ready" } },
    { event: "progress", data: { phase: "stops", cityNames: ["Waco, TX", "Austin, TX"] } },
    { event: "complete", data: complete },
  ]);

  await page.route("**/api/plan-trip", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      },
      body,
    });
  });
}

export async function clickGenerate(page) {
  const btn = page.locator(".btn-generate-trip").first();
  await expect(btn).toBeEnabled();
  await btn.scrollIntoViewIfNeeded();
  try {
    await btn.click({ timeout: 5_000 });
  } catch {
    await btn.evaluate(el => el.click());
  }
}

export async function expectGenerationOverlay(page) {
  const overlay = page.locator(".generation-stream-overlay");
  await expect(overlay).toBeVisible({ timeout: 8_000 });
  return overlay;
}

export async function expectOverlayRouteLoader(overlay) {
  const loader = overlay.locator(".route-drawing-loader-svg").first();
  await expect(loader).toBeVisible({ timeout: 10_000 });
  return loader;
}

export async function expectOverlayShowsRoute(page, pattern) {
  const overlay = page.locator(".generation-stream-overlay");
  await expect(overlay).toContainText(pattern, { timeout: 8_000 });
}

export async function expectGenerationCompletes(page) {
  await expect(page.locator(".plan-generation-error")).toHaveCount(0, { timeout: 45_000 });
  await expect(
    page.locator(".app-wrap.results-fullscreen, .app-wrap.map-fullscreen-mode, .trip-results-split").first(),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".generation-stream-overlay")).toHaveCount(0, { timeout: 15_000 });
}

export async function waitForOverlayChunkPreload(page, timeoutMs = 25_000) {
  await page.waitForFunction(
    () => performance.getEntriesByType("resource").some(entry => entry.name.includes("GenerationStreamOverlay")),
    { timeout: timeoutMs },
  );
}

export async function installE2eAuthSession(page) {
  await page.addInitScript(() => {
    window.__TRIPMAPPA_E2E_AUTH__ = true;
  });
  await page.route("**/api/trip-credits", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier: "wanderer",
        unlimited: false,
        remaining: 3,
        limit: 3,
        used: 0,
        groceryDelivery: false,
      }),
    });
  });
}
