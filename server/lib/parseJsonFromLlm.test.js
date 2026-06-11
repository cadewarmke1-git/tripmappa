import { describe, expect, it } from "vitest";
import { parseJsonFromLlm } from "./parseJsonFromLlm.js";

describe("parseJsonFromLlm", () => {
  it("parses raw JSON", () => {
    const parsed = parseJsonFromLlm('{"stops":[{"city":"Austin"}]}');
    expect(parsed.stops[0].city).toBe("Austin");
  });

  it("strips markdown fences and preamble", () => {
    const parsed = parseJsonFromLlm(
      "Here is the trip:\n```json\n{\"stops\":[{\"city\":\"Dallas\"}]}\n```\nDone.",
    );
    expect(parsed.stops[0].city).toBe("Dallas");
  });

  it("salvages truncated JSON by closing open structures", () => {
    const truncated = '{"stops":[{"city":"Austin","name":"Stop A"},{"city":"Dallas"';
    const parsed = parseJsonFromLlm(truncated);
    expect(Array.isArray(parsed.stops)).toBe(true);
    expect(parsed.stops.length).toBeGreaterThanOrEqual(1);
  });

  it("throws with a descriptive error for empty input", () => {
    expect(() => parseJsonFromLlm("")).toThrow(/empty/i);
  });
});
