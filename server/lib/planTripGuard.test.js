import { describe, expect, it, vi } from "vitest";
import {
  requireTripMappaClient,
  validatePlanTripPayload,
} from "./planTripGuard.js";

function mockRes() {
  let statusCode = 200;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return undefined;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

describe("planTripGuard", () => {
  it("returns true on missing client header so callers can exit immediately", () => {
    const { res, getStatus, getBody } = mockRes();
    const rejected = requireTripMappaClient({ headers: {} }, res);
    expect(rejected).toBe(true);
    expect(getStatus()).toBe(403);
    expect(getBody()?.code).toBe("invalid_client");
  });

  it("returns null when client header is valid", () => {
    const { res } = mockRes();
    expect(requireTripMappaClient({ headers: { "x-tripmappa-client": "web" } }, res)).toBeNull();
  });

  it("returns true on empty origin", () => {
    const { res, getStatus, getBody } = mockRes();
    const rejected = validatePlanTripPayload(
      { origin: "", destination: "Dallas, TX", answers: { vehicle: "Car" } },
      res,
    );
    expect(rejected).toBe(true);
    expect(getStatus()).toBe(400);
    expect(getBody()?.code).toBe("invalid_origin");
  });

  it("returns true on missing vehicle", () => {
    const { res, getStatus, getBody } = mockRes();
    const rejected = validatePlanTripPayload(
      { origin: "Austin, TX", destination: "Dallas, TX", answers: {} },
      res,
    );
    expect(rejected).toBe(true);
    expect(getStatus()).toBe(400);
    expect(getBody()?.code).toBe("missing_vehicle");
  });

  it("rejects oversized answers payloads", () => {
    const { res, getStatus, getBody } = mockRes();
    const answers = { vehicle: "Car", notes: "x".repeat(60_000) };
    const rejected = validatePlanTripPayload(
      { origin: "Austin, TX", destination: "Dallas, TX", answers },
      res,
    );
    expect(rejected).toBe(true);
    expect(getStatus()).toBe(400);
    expect(getBody()?.code).toBe("answers_too_large");
  });

  it("clips answer strings in place when valid", () => {
    const { res } = mockRes();
    const body = {
      origin: "  Austin, TX  ",
      destination: "Dallas, TX",
      answers: { vehicle: "Car", notes: "y".repeat(800) },
    };
    expect(validatePlanTripPayload(body, res)).toBeNull();
    expect(body.origin).toBe("Austin, TX");
    expect(body.answers.notes.length).toBe(500);
  });
});
