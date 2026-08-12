import { describe, expect, it } from "vitest";
import { formatTripmappaFromAddress } from "./sendEmail.js";

describe("formatTripmappaFromAddress", () => {
  it("adds TripMappa display name to a bare mailbox", () => {
    expect(formatTripmappaFromAddress("hello@tripmappa.com")).toBe(
      "TripMappa <hello@tripmappa.com>",
    );
  });

  it("keeps an existing display name", () => {
    expect(formatTripmappaFromAddress("TripMappa Team <hello@tripmappa.com>")).toBe(
      "TripMappa Team <hello@tripmappa.com>",
    );
  });

  it("fills empty angle-bracket name with TripMappa", () => {
    expect(formatTripmappaFromAddress("<hello@tripmappa.com>")).toBe(
      "TripMappa <hello@tripmappa.com>",
    );
  });
});
