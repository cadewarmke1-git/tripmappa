import { describe, expect, it } from "vitest";
import {
  clampString,
  isValidInviteToken,
  isValidShareToken,
  resolveAllowedModel,
  PLAN_TRIP_MODELS,
  CLAUDE_PROXY_MODELS,
} from "./apiSecurity.js";

describe("apiSecurity", () => {
  it("clamps strings to max length", () => {
    expect(clampString("abcdef", 3)).toBe("abc");
    expect(clampString(null, 3)).toBe("");
  });

  it("validates share and invite tokens", () => {
    expect(isValidShareToken("abc")).toBe(false);
    expect(isValidShareToken("a".repeat(24))).toBe(true);
    expect(isValidInviteToken("not-hex")).toBe(false);
    expect(isValidInviteToken("a".repeat(36))).toBe(true);
  });

  it("resolves only allowlisted models", () => {
    expect(resolveAllowedModel("claude-sonnet-4-6", "claude-sonnet-4-6", PLAN_TRIP_MODELS)).toBe("claude-sonnet-4-6");
    expect(resolveAllowedModel("evil-model", "claude-sonnet-4-6", PLAN_TRIP_MODELS)).toBe("claude-sonnet-4-6");
    expect(resolveAllowedModel("claude-haiku-4-5-20251001", "claude-haiku-4-5-20251001", CLAUDE_PROXY_MODELS)).toBe("claude-haiku-4-5-20251001");
  });
});
