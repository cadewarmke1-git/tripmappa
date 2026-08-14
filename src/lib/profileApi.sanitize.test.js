import { describe, expect, it } from "vitest";

// Mirror of CLIENT_WRITABLE_PROFILE_KEYS / sanitize behavior in profileApi.js
const CLIENT_WRITABLE_PROFILE_KEYS = new Set([
  "display_name",
  "avatar_url",
  "home_address",
  "emergency_contact_phone",
  "notify_trip_reminders",
  "notify_new_features",
  "traveler_profile",
  "onboarding_complete",
]);

function sanitizeClientProfilePatch(patch) {
  const out = {};
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return out;
  for (const [key, value] of Object.entries(patch)) {
    if (!CLIENT_WRITABLE_PROFILE_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

describe("client profile patch allowlist", () => {
  it("strips tier, credits, and stripe fields", () => {
    const safe = sanitizeClientProfilePatch({
      display_name: "Cade",
      tier: "trailblazer",
      generations_used: 0,
      stripe_customer_id: "cus_x",
      plan_preferences: { monthly_generation_count: 0 },
      home_address: "Austin, TX",
    });
    expect(safe).toEqual({ display_name: "Cade", home_address: "Austin, TX" });
  });
});
