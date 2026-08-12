import { beforeEach, describe, expect, it, vi } from "vitest";

const sendFounderWelcomeEmail = vi.fn(async () => ({ sent: true }));

vi.mock("./email/founderWelcome.js", () => ({
  sendFounderWelcomeEmail: (...args) => sendFounderWelcomeEmail(...args),
}));

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("tryClaimFoundingSlot Founder welcome email", () => {
  beforeEach(() => {
    sendFounderWelcomeEmail.mockClear();
    delete process.env.ADMIN_USER_IDS;
  });

  it("sends welcome email once on a successful new claim", async () => {
    const { tryClaimFoundingSlot } = await import("./foundingMembers.js");
    const calls = { insert: 0, upsert: 0 };
    const admin = {
      from(table) {
        if (table === "founding_members") {
          return {
            select(_cols, opts) {
              if (opts?.count === "exact" && opts?.head) {
                return Promise.resolve({ count: 4, error: null });
              }
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
                then(resolve, reject) {
                  return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                },
              };
            },
            insert: async () => {
              calls.insert += 1;
              return { error: null };
            },
          };
        }
        if (table === "user_profiles") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: { tier: "wanderer", stripe_subscription_id: null },
                      error: null,
                    }),
                  };
                },
              };
            },
            upsert: async () => {
              calls.upsert += 1;
              return { error: null };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { email: "traveler@example.com" } },
            error: null,
          }),
        },
      },
    };

    const result = await tryClaimFoundingSlot(admin, USER_ID);
    expect(result.claimed).toBe(true);
    expect(result.already).toBeUndefined();
    expect(calls.insert).toBe(1);
    expect(calls.upsert).toBe(1);
    expect(sendFounderWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(sendFounderWelcomeEmail.mock.calls[0][1]).toBe(USER_ID);
    expect(result.welcomeEmail).toEqual({ sent: true });
  });

  it("does not send when the user already has a founding slot", async () => {
    const { tryClaimFoundingSlot } = await import("./foundingMembers.js");
    const admin = {
      from(table) {
        if (table === "founding_members") {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({ data: { user_id: USER_ID }, error: null }),
                  };
                },
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const result = await tryClaimFoundingSlot(admin, USER_ID);
    expect(result).toEqual({ claimed: true, already: true });
    expect(sendFounderWelcomeEmail).not.toHaveBeenCalled();
  });
});
