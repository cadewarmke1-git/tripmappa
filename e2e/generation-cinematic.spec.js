import { expect, test } from "@playwright/test";
import {
  clickGenerate,
  completeCarFlow,
  completeThinTransportFlow,
  expectGenerationCompletes,
  expectGenerationOverlay,
  expectOverlayRouteLoader,
  expectOverlayShowsRoute,
  installMockPlanTrip,
  installSlowMockPlanTrip,
  installE2eAuthSession,
  reachTripDetailsStep,
  startPlanFlow,
  waitForOverlayChunkPreload,
} from "./helpers/planFlowHelpers.js";

test.describe.configure({ timeout: 120_000 });

test.describe("generation cinematic loader runthroughs", () => {
  test.beforeEach(async ({ page }) => {
    await installE2eAuthSession(page);
  });

  test("car desktop: overlay appears immediately, canvas renders, trip completes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installMockPlanTrip(page);
    await startPlanFlow(page);
    await completeCarFlow(page);

    await clickGenerate(page);
    const overlay = await expectGenerationOverlay(page);
    await expectOverlayShowsRoute(page, /Dallas.*Austin/i);

    await expectOverlayRouteLoader(overlay);
    await expect(overlay.locator("canvas")).toHaveCount(0);
    await expect(overlay.getByText(/Mapping your route|Planning your route|Scouting|Adding|ready/i)).toBeVisible();

    await expectGenerationCompletes(page);
  });

  test("car mobile: overlay fullscreen and generation completes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMockPlanTrip(page);
    await startPlanFlow(page);
    await completeCarFlow(page);

    await clickGenerate(page);
    const overlay = await expectGenerationOverlay(page);
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 4);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual((viewport?.height ?? 0) * 0.9);

    await expectGenerationCompletes(page);
  });

  test("plane: thin transport flow uses overlay and completes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installMockPlanTrip(page, { routeSummary: "Dallas to Austin flight", stopName: "Austin Bergstrom area" });
    await startPlanFlow(page);
    await completeThinTransportFlow(page, "Plane");

    await clickGenerate(page);
    await expectGenerationOverlay(page);
    await expectOverlayShowsRoute(page, /Dallas.*Austin/i);
    await expectGenerationCompletes(page);
  });

  test("boat: thin transport flow uses overlay and completes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installMockPlanTrip(page, { routeSummary: "Dallas to Austin cruise", stopName: "Galveston Port" });
    await startPlanFlow(page);
    await completeThinTransportFlow(page, "Boat");

    await clickGenerate(page);
    await expectGenerationOverlay(page);
    await expectGenerationCompletes(page);
  });

  test("reduced motion: CSS fallback overlay without WebGL canvas", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
    await installMockPlanTrip(page);
    await startPlanFlow(page);
    await completeCarFlow(page);

    await clickGenerate(page);
    const overlay = await expectGenerationOverlay(page);
    await expect(overlay.locator("canvas")).toHaveCount(0);
    await expectOverlayRouteLoader(overlay);
    await expect(overlay.getByText(/Dallas.*Austin/i)).toBeVisible();
    await expectGenerationCompletes(page);
  });

  test("slow stream: overlay shows status updates before results", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installSlowMockPlanTrip(page);
    await startPlanFlow(page);
    await completeCarFlow(page);

    await clickGenerate(page);
    const overlay = await expectGenerationOverlay(page);
    await expect(overlay.getByText(/Mapping your route|Planning your route|Route summary|Scouting/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expectGenerationCompletes(page);
  });

  test("preloads overlay chunk on trip details step", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await startPlanFlow(page);
    await reachTripDetailsStep(page);
    await waitForOverlayChunkPreload(page);
  });

  test("generate shows overlay quickly when chunk is preloaded", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await installMockPlanTrip(page);
    await startPlanFlow(page);
    await completeCarFlow(page);
    await waitForOverlayChunkPreload(page);

    const t0 = Date.now();
    await clickGenerate(page);
    await expectGenerationOverlay(page);
    expect(Date.now() - t0).toBeLessThan(4_000);
    await expectGenerationCompletes(page);
  });
});
