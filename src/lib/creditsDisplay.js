import { TIERS, normalizeTier } from "./tiers.js";

/** Plan-panel generation counter copy and upgrade nudges. */
export function formatCreditsDisplay(status) {
  if (!status || status.isAdmin) {
    return { label: null, nudge: null };
  }

  if (status.tier === "guest") {
    return { label: "1 free generation", nudge: null };
  }

  if (status.unlimited) {
    return { label: null, nudge: null };
  }

  if (status.billingPeriod === "monthly") {
    const remaining = status.remaining ?? 0;
    const limit = status.limit ?? 0;
    const label = `${remaining} of ${limit} remaining this month`;
    const usedThisMonth = status.monthlyUsed ?? status.used ?? 0;
    const nudge = normalizeTier(status.tier) === TIERS.VOYAGER && usedThisMonth >= 15
      ? "Running low — Trailblazer includes 100 generations per month."
      : null;
    return { label, nudge };
  }

  const remaining = status.remaining ?? 0;
  if (remaining === 1) {
    return { label: "1 free generation remaining", nudge: null };
  }
  return { label: `${remaining} free generations remaining`, nudge: null };
}

export function formatResetDate(resetDate) {
  if (!resetDate) return "the first of next month";
  const d = new Date(`${resetDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "the first of next month";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
