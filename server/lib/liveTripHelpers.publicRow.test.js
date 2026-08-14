import { describe, expect, it, vi } from "vitest";
import { publicLiveTripRow } from "./liveTripHelpers.js";

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

const SECRET_ROW = {
  id: "trip-1",
  share_token: "abcdefghijklmnopqrstuvwx",
  is_active: true,
  convoy_mode: true,
  destination: "Austin, TX",
  convoy_members: [{ id: "m1", name: "Alex" }],
  user_id: "owner-uuid-should-not-leak",
  follower_phones: ["+15551234567", "+15559876543"],
};

describe("publicLiveTripRow convoy PII redaction", () => {
  it("strips follower_phones and user_id from the public row", () => {
    const publicRow = publicLiveTripRow(SECRET_ROW);
    expect(publicRow).not.toHaveProperty("follower_phones");
    expect(publicRow).not.toHaveProperty("user_id");
    expect(publicRow.share_token).toBe(SECRET_ROW.share_token);
    expect(publicRow.convoy_members).toEqual(SECRET_ROW.convoy_members);
    expect(JSON.stringify(publicRow)).not.toContain("follower_phones");
    expect(JSON.stringify(publicRow)).not.toContain("+15551234567");
  });
});

describe("join-convoy and update-convoy-location responses", () => {
  it("join-convoy liveTrip response omits follower_phones", async () => {
    const members = [];
    const updated = { ...SECRET_ROW, convoy_members: [{ id: "new", name: "Sam" }] };
    const admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: { ...SECRET_ROW, convoy_members: members },
            error: null,
          }),
          update() {
            return this;
          },
          single: async () => ({ data: updated, error: null }),
        };
      },
    };

    vi.resetModules();
    vi.doMock("../lib/supabaseAdmin.js", () => ({ getSupabaseAdmin: () => admin }));
    vi.doMock("../lib/sentry.js", () => ({ captureServerException: () => {} }));
    vi.doMock("../lib/apiSecurity.js", () => ({
      guardTokenWriteRoute: () => false,
      isValidShareToken: () => true,
    }));

    const { default: joinConvoy } = await import("../routes/join-convoy.js");
    const { res, getStatus, getBody } = mockRes();
    await joinConvoy(
      {
        method: "POST",
        body: { shareToken: SECRET_ROW.share_token, displayName: "Sam" },
      },
      res,
    );

    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.liveTrip).toBeTruthy();
    expect(body.liveTrip).not.toHaveProperty("follower_phones");
    expect(body.liveTrip).not.toHaveProperty("user_id");
    expect(JSON.stringify(body)).not.toMatch(/follower_phones/);
    expect(JSON.stringify(body)).not.toContain("+15551234567");
  });

  it("update-convoy-location liveTrip response omits follower_phones", async () => {
    const withMember = {
      ...SECRET_ROW,
      convoy_members: [{ id: "m1", name: "Alex", latitude: 30, longitude: -97 }],
    };
    const admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: withMember, error: null }),
          update() {
            return this;
          },
          single: async () => ({
            data: {
              ...withMember,
              convoy_members: [{ id: "m1", name: "Alex", latitude: 31, longitude: -98 }],
            },
            error: null,
          }),
        };
      },
    };

    vi.resetModules();
    vi.doMock("../lib/supabaseAdmin.js", () => ({ getSupabaseAdmin: () => admin }));
    vi.doMock("../lib/sentry.js", () => ({ captureServerException: () => {} }));
    vi.doMock("../lib/googleKey.js", () => ({ getGoogleMapsKey: () => null }));
    vi.doMock("../lib/apiSecurity.js", () => ({
      guardTokenWriteRoute: () => false,
      isValidShareToken: () => true,
    }));

    const { default: updateConvoyLocation } = await import("../routes/update-convoy-location.js");
    const { res, getStatus, getBody } = mockRes();
    await updateConvoyLocation(
      {
        method: "POST",
        body: {
          shareToken: SECRET_ROW.share_token,
          memberId: "m1",
          latitude: 31,
          longitude: -98,
        },
      },
      res,
    );

    expect(getStatus()).toBe(200);
    const body = getBody();
    expect(body.liveTrip).toBeTruthy();
    expect(body.liveTrip).not.toHaveProperty("follower_phones");
    expect(body.liveTrip).not.toHaveProperty("user_id");
    expect(JSON.stringify(body)).not.toMatch(/follower_phones/);
    expect(JSON.stringify(body)).not.toContain("+15551234567");
  });
});
