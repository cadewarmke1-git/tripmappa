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
  convoy_members: [{ id: "m1", name: "Alex", location_secret: "member-write-secret" }],
  user_id: "owner-uuid-should-not-leak",
  follower_phones: ["+15551234567", "+15559876543"],
};

describe("publicLiveTripRow convoy PII redaction", () => {
  it("strips follower_phones, user_id, and convoy location secrets", () => {
    const publicRow = publicLiveTripRow(SECRET_ROW);
    expect(publicRow).not.toHaveProperty("follower_phones");
    expect(publicRow).not.toHaveProperty("user_id");
    expect(publicRow.share_token).toBe(SECRET_ROW.share_token);
    expect(publicRow.convoy_members).toEqual([{ id: "m1", name: "Alex" }]);
    expect(JSON.stringify(publicRow)).not.toContain("follower_phones");
    expect(JSON.stringify(publicRow)).not.toContain("+15551234567");
    expect(JSON.stringify(publicRow)).not.toContain("member-write-secret");
    expect(JSON.stringify(publicRow)).not.toContain("location_secret");
  });
});

describe("join-convoy and update-convoy-location responses", () => {
  it("join-convoy returns write secret to joiner but strips it from liveTrip", async () => {
    const members = [];
    let savedMembers = null;
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
          update(patch) {
            savedMembers = patch.convoy_members;
            return this;
          },
          single: async () => ({
            data: { ...SECRET_ROW, convoy_members: savedMembers },
            error: null,
          }),
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
    expect(body.member?.location_secret).toMatch(/^[a-f0-9]{32}$/);
    expect(body.liveTrip).toBeTruthy();
    expect(body.liveTrip).not.toHaveProperty("follower_phones");
    expect(body.liveTrip).not.toHaveProperty("user_id");
    expect(JSON.stringify(body.liveTrip)).not.toContain(body.member.location_secret);
    expect(JSON.stringify(body)).not.toMatch(/follower_phones/);
    expect(JSON.stringify(body)).not.toContain("+15551234567");
  });

  it("update-convoy-location requires location secret and redacts public row", async () => {
    const withMember = {
      ...SECRET_ROW,
      convoy_members: [{
        id: "m1",
        name: "Alex",
        location_secret: "member-write-secret",
        latitude: 30,
        longitude: -97,
      }],
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
              convoy_members: [{
                id: "m1",
                name: "Alex",
                location_secret: "member-write-secret",
                latitude: 31,
                longitude: -98,
              }],
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
    const denied = mockRes();
    await updateConvoyLocation(
      {
        method: "POST",
        body: {
          shareToken: SECRET_ROW.share_token,
          memberId: "m1",
          locationSecret: "wrong-secret",
          latitude: 31,
          longitude: -98,
        },
      },
      denied.res,
    );
    expect(denied.getStatus()).toBe(403);

    const { res, getStatus, getBody } = mockRes();
    await updateConvoyLocation(
      {
        method: "POST",
        body: {
          shareToken: SECRET_ROW.share_token,
          memberId: "m1",
          locationSecret: "member-write-secret",
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
    expect(JSON.stringify(body.liveTrip)).not.toContain("member-write-secret");
    expect(JSON.stringify(body)).not.toMatch(/follower_phones/);
    expect(JSON.stringify(body)).not.toContain("+15551234567");
  });
});
