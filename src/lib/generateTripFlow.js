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

/** True when the planner returned trip content (API or client-side fallback). */
export function isTripPlanComplete(parsed) {
  if (!parsed) return false;
  return Boolean(parsed.stops?.length || parsed.roadStops?.length);
}

export function generationFailureMessage(err) {
  if (err?.code === "no_credits") return "No trip generations remaining.";
  if (err?.message?.includes("incomplete")) {
    return "We couldn't build a complete trip plan. Please try again in a moment.";
  }
  return "Trip planning failed. Please try again in a moment.";
}

/** @deprecated use isTripPlanComplete */
export function assertTripResultReady(parsed) {
  return isTripPlanComplete(parsed);
}
