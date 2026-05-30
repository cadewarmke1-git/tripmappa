/** Client-side guards for the Generate My Trip action (unit-tested). */

export function canStartTripGeneration({
  inFlight = false,
  origin = "",
  dest = "",
  convoComplete = false,
  creditsRemaining = 0,
  unlimited = false,
} = {}) {
  if (inFlight) return { ok: false, reason: "in_flight" };
  if (!String(origin).trim() || !String(dest).trim()) {
    return { ok: false, reason: "missing_route" };
  }
  if (!convoComplete) return { ok: false, reason: "incomplete_questions" };
  if (!unlimited && (creditsRemaining ?? 0) <= 0) {
    return { ok: false, reason: "no_credits" };
  }
  return { ok: true };
}

/** After a successful API parse, these fields must be present to show results. */
export function assertTripResultReady(parsed) {
  return Boolean(parsed?.stops?.length);
}
