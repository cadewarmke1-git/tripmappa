import { describe, expect, it } from "vitest";

// Mirror grocery route caps for unit coverage without spinning up the full handler.
const MAX_ITEMS = 40;
const MAX_ITEM_LEN = 120;

function clipText(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function sanitizeGroceryItems(items) {
  if (!Array.isArray(items)) return { error: "At least one grocery item is required" };
  if (items.length > MAX_ITEMS) return { error: `At most ${MAX_ITEMS} grocery items allowed` };
  const cleaned = items
    .map((item) => clipText(typeof item === "string" ? item : String(item || ""), MAX_ITEM_LEN))
    .filter(Boolean);
  if (!cleaned.length) return { error: "At least one grocery item is required" };
  return { items: cleaned };
}

describe("grocery order validation caps", () => {
  it("rejects empty item lists", () => {
    expect(sanitizeGroceryItems([])).toEqual({ error: "At least one grocery item is required" });
  });

  it("caps item count and item length", () => {
    expect(sanitizeGroceryItems(Array(MAX_ITEMS + 1).fill("milk")).error).toMatch(/At most/);
    const { items } = sanitizeGroceryItems(["  " + "x".repeat(200) + "  "]);
    expect(items[0].length).toBe(MAX_ITEM_LEN);
  });
});

describe("auth throttle route wiring", () => {
  it("exports a default handler", async () => {
    const mod = await import("../../server/routes/auth-throttle.js");
    expect(typeof mod.default).toBe("function");
  });
});
