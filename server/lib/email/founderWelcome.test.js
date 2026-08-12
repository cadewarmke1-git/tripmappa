import { describe, expect, it, vi, afterEach } from "vitest";
import { welcomeFounderEmail, welcomePlanEmail } from "./templates.js";

describe("welcomeFounderEmail", () => {
  it("uses final Founder copy with firstName and support contact, not paid-upgrade copy", () => {
    const paid = welcomePlanEmail({
      planName: "Voyager",
      benefits: ["6 trip generations per month"],
      billingDate: "September 1, 2026",
    });
    const founder = welcomeFounderEmail({
      firstName: "Cade",
      expiresLabel: "November 11, 2026",
    });

    expect(founder.subject).toBe("Welcome to TripMappa, Cade");
    expect(founder.subject).not.toContain("PLACEHOLDER");
    expect(founder.subject).not.toContain("Founding Member");
    expect(founder.subject).not.toBe(paid.subject);
    expect(founder.html).not.toContain("PLACEHOLDER");
    expect(founder.html).not.toContain("#1A1035");
    expect(founder.html).not.toContain("#A89BCF");
    expect(founder.html).toContain("#0D0A1A");
    expect(founder.html).toContain("#FFD28C");
    expect(founder.html).toContain("#FF8C42");
    expect(founder.html).toContain("#FDF3E0");
    expect(founder.html).toContain("Welcome, Cade");
    expect(founder.html).toContain("first 250 Founding Members");
    expect(founder.html).toContain("November 11, 2026");
    expect(founder.html).toContain("support@tripmappa.com");
    expect(founder.html).toContain("Report this stop");
    expect(founder.html).toContain("Cade<br />Founder, TripMappa");
    expect(founder.html).toContain("Open TripMappa");
    expect(founder.html).not.toContain("Thank you for subscribing");
    expect(founder.text).toContain("Welcome, Cade");
    expect(founder.text).toContain("support@tripmappa.com");
    expect(founder.text).not.toContain("PLACEHOLDER");
  });

  it("falls back to Welcome heading and subject when firstName is missing", () => {
    const founder = welcomeFounderEmail({ expiresLabel: "November 11, 2026" });
    expect(founder.subject).toBe("Welcome to TripMappa");
    expect(founder.html).toContain(">Welcome<");
    expect(founder.html).not.toContain("Welcome,");
    expect(founder.text.startsWith("Welcome\n")).toBe(true);
  });
});

describe("sendFounderWelcomeEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unmock("./sendEmail.js");
  });

  it("sends via Resend helpers with the Founder template and resolved firstName", async () => {
    const sendTripmappaEmail = vi.fn(async () => ({ sent: true, from: "TripMappa <hello@tripmappa.com>" }));
    vi.doMock("./sendEmail.js", () => ({
      getUserEmail: vi.fn(async () => "founder.test@tripmappa.test"),
      sendTripmappaEmail,
    }));

    const admin = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { display_name: "Alex Rivera" }, error: null }),
                };
              },
            };
          },
        };
      },
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: {} }, error: null }),
        },
      },
    };

    const { sendFounderWelcomeEmail } = await import("./founderWelcome.js?mock=" + Date.now());
    const result = await sendFounderWelcomeEmail(admin, "user-1", {
      founderExpiresAt: "2026-11-11T00:00:00.000Z",
    });

    expect(result.sent).toBe(true);
    expect(result.personalized).toBe(true);
    expect(result.firstName).toBe("Alex");
    expect(sendTripmappaEmail).toHaveBeenCalledTimes(1);
    const arg = sendTripmappaEmail.mock.calls[0][0];
    expect(arg.to).toBe("founder.test@tripmappa.test");
    expect(arg.subject).toBe("Welcome to TripMappa, Alex");
    expect(arg.html).toContain("Welcome, Alex");
    expect(arg.html).toContain("support@tripmappa.com");
    expect(arg.html).not.toContain("PLACEHOLDER");
    expect(arg.html).not.toContain("#A89BCF");
  });
});
