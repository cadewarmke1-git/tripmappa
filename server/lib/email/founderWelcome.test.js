import { describe, expect, it, vi, afterEach } from "vitest";
import { welcomeFounderEmail, welcomePlanEmail } from "./templates.js";

describe("welcomeFounderEmail", () => {
  it("uses Founder-specific subject and placeholder body, not paid-upgrade copy", () => {
    const paid = welcomePlanEmail({
      planName: "Voyager",
      benefits: ["6 trip generations per month"],
      billingDate: "September 1, 2026",
    });
    const founder = welcomeFounderEmail({ expiresLabel: "November 11, 2026" });

    expect(founder.subject).toContain("PLACEHOLDER");
    expect(founder.subject).toContain("Founder");
    expect(founder.subject).not.toBe(paid.subject);
    expect(founder.html).toContain("PLACEHOLDER");
    expect(founder.html).toContain("first 250");
    expect(founder.html).toContain("November 11, 2026");
    expect(founder.html).toContain("Founder badge");
    expect(founder.html).not.toContain("Thank you for subscribing");
    expect(founder.text).toContain("PLACEHOLDER");
  });
});

describe("sendFounderWelcomeEmail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unmock("./sendEmail.js");
  });

  it("sends via Resend helpers with the Founder template", async () => {
    const sendTripmappaEmail = vi.fn(async () => ({ sent: true }));
    vi.doMock("./sendEmail.js", () => ({
      getUserEmail: vi.fn(async () => "founder.test@tripmappa.test"),
      sendTripmappaEmail,
    }));

    const { sendFounderWelcomeEmail } = await import("./founderWelcome.js?mock=" + Date.now());
    const result = await sendFounderWelcomeEmail({}, "user-1", {
      founderExpiresAt: "2026-11-11T00:00:00.000Z",
    });

    expect(result.sent).toBe(true);
    expect(sendTripmappaEmail).toHaveBeenCalledTimes(1);
    const arg = sendTripmappaEmail.mock.calls[0][0];
    expect(arg.to).toBe("founder.test@tripmappa.test");
    expect(arg.subject).toContain("Founder");
    expect(arg.html).toContain("PLACEHOLDER");
  });
});
