import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "./asyncPool.js";

describe("asyncPool", () => {
  it("preserves result order with limited concurrency", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrency(items, 2, async (value) => {
      await new Promise(r => setTimeout(r, 5 - value));
      return value * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });
});
