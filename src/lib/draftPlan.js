const DRAFT_KEY = "tripmappa-plan-draft";

export function savePlanDraft(draft) {
  if (!draft?.origin || !draft?.dest) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...draft,
      savedAt: Date.now(),
    }));
  } catch {
    /* storage full or private mode */
  }
}

export function loadPlanDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.origin || !parsed?.dest) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlanDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export function hasPlanDraft() {
  return loadPlanDraft() != null;
}
