import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingStopRejections,
  describeStopRejection,
  mergeStopRejection,
  normalizeRejectionCategory,
  pendingStopRejectionCount,
  REJECTION_SOURCE,
  REJECTION_UNDO_DELAY_MS,
  sanitizeStopRejections,
  scheduleStopRejection,
  formatStopRejectionsForPrompt,
} from "./stopRejectionPreferences.js";

describe("stopRejectionPreferences", () => {
  afterEach(() => {
    clearPendingStopRejections();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes categories from kind and stop fields", () => {
    expect(normalizeRejectionCategory({}, "restaurant")).toBe("restaurant");
    expect(normalizeRejectionCategory({ category: "Fuel stop" }, "road")).toBe("fuel");
    expect(normalizeRejectionCategory({ category: "scenic overlook" }, null)).toBe("attraction");
    expect(normalizeRejectionCategory({}, "lodging")).toBe("lodging");
  });

  it("extracts type for steakhouse and scenic and tags source", () => {
    expect(describeStopRejection({ name: "Texas Steakhouse" }, "restaurant", REJECTION_SOURCE.card_hide)).toEqual({
      category: "restaurant",
      type: "Steakhouse",
      source: "card_hide",
    });
    expect(describeStopRejection({ name: "Canyon Overlook", category: "scenic" }, "road", REJECTION_SOURCE.itinerary_remove)).toEqual({
      category: "attraction",
      type: "scenic",
      source: "itinerary_remove",
    });
  });

  it("merges rejection counts and by_source buckets", () => {
    const once = mergeStopRejection(
      null,
      { name: "Texas Steakhouse" },
      "restaurant",
      REJECTION_SOURCE.card_hide,
    );
    expect(once.categories.restaurant).toBe(1);
    expect(once.types.Steakhouse).toBe(1);
    expect(once.by_source.card_hide.categories.restaurant).toBe(1);
    expect(once.by_source.itinerary_remove.categories).toEqual({});

    const twice = mergeStopRejection(
      once,
      { name: "Canyon Overlook", category: "scenic" },
      "road",
      REJECTION_SOURCE.itinerary_remove,
    );
    expect(twice.categories.attraction).toBe(1);
    expect(twice.by_source.itinerary_remove.types.scenic).toBe(1);
    expect(twice.by_source.card_hide.categories.restaurant).toBe(1);
  });

  it("sanitizes malformed rejection payloads including by_source", () => {
    expect(sanitizeStopRejections({
      categories: { restaurant: 2, bad: -1 },
      types: { Steakhouse: 3.7 },
      by_source: {
        card_hide: { categories: { restaurant: 2 }, types: { Steakhouse: 1 } },
        itinerary_remove: { categories: { fuel: "x" }, types: {} },
      },
    })).toEqual({
      categories: { restaurant: 2 },
      types: { Steakhouse: 3 },
      by_source: {
        itinerary_remove: { categories: {}, types: {} },
        card_hide: { categories: { restaurant: 2 }, types: { Steakhouse: 1 } },
      },
    });
  });

  it("formats compressed stop-rejection context for Claude", () => {
    expect(formatStopRejectionsForPrompt(null)).toBe("");
    expect(formatStopRejectionsForPrompt({ categories: {}, types: {} })).toBe("");
    const block = formatStopRejectionsForPrompt({
      categories: { restaurant: 2, attraction: 1 },
      types: { Steakhouse: 2, scenic: 1 },
    });
    expect(block).toContain("STOP REJECTIONS");
    expect(block).toContain("Avoid categories: restaurant (2x), attraction (1x)");
    expect(block).toContain("Avoid types: Steakhouse (2x), scenic (1x)");
  });

  it("is undo-safe: cancelled schedule never records", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const cancel = scheduleStopRejection("token", { name: "Pilot", category: "fuel", id: "f1" }, {
      kind: "road",
      source: REJECTION_SOURCE.itinerary_remove,
      delayMs: REJECTION_UNDO_DELAY_MS,
    });
    expect(pendingStopRejectionCount()).toBe(1);
    cancel();
    expect(pendingStopRejectionCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(REJECTION_UNDO_DELAY_MS + 50);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes after undo window when not cancelled", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(async (url, init) => {
      if (String(url).includes("/api/plan-preferences") && (!init || init.method == null || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({ preferences: { vehicle: "Car" }, meta: {} }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          preferences: { vehicle: "Car" },
          meta: {
            stop_rejections: mergeStopRejection(
              null,
              { name: "Pilot", category: "fuel" },
              "road",
              REJECTION_SOURCE.itinerary_remove,
            ),
          },
        }),
      };
    });

    scheduleStopRejection("token", { name: "Pilot", category: "fuel", id: "f2" }, {
      kind: "road",
      source: REJECTION_SOURCE.itinerary_remove,
    });
    expect(pendingStopRejectionCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(REJECTION_UNDO_DELAY_MS + 10);
    expect(pendingStopRejectionCount()).toBe(0);
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
