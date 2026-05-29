import { describe, expect, it } from "vitest";
import { formatStarLabel, isLocalFavorite, parseRating } from "./ratings.js";

describe("ratings", () => {
  it("parses valid ratings and rejects invalid values", () => {
    expect(parseRating("4.56")).toBe(4.6);
    expect(parseRating(0)).toBeNull();
    expect(parseRating("n/a")).toBeNull();
  });

  it("formats star labels without unicode symbols", () => {
    expect(formatStarLabel(4.5)).toBe("4.5 / 5");
    expect(formatStarLabel(null)).toBeNull();
  });

  it("flags local favorites at 4.5+", () => {
    expect(isLocalFavorite(4.5)).toBe(true);
    expect(isLocalFavorite(4.4)).toBe(false);
  });
});
