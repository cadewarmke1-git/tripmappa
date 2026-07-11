import {
  PLAN_DRAFT_KEY,
  readLocalStorage,
  writeLocalStorage,
  removeLocalStorage,
} from "./storageKeys.js";

export function savePlanDraft(draft) {
  if (!draft?.origin || !draft?.dest) return;
  writeLocalStorage(PLAN_DRAFT_KEY, JSON.stringify({
    ...draft,
    savedAt: Date.now(),
  }));
}

export function loadPlanDraft() {
  try {
    const raw = readLocalStorage(PLAN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.origin || !parsed?.dest) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlanDraft() {
  removeLocalStorage(PLAN_DRAFT_KEY);
}
