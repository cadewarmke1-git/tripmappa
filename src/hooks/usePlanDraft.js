import { useEffect } from "react";
import { savePlanDraft, loadPlanDraft, clearPlanDraft } from "../lib/draftPlan.js";

export function usePlanDraft({
  active,
  origin,
  dest,
  answers,
  questionHistory,
  convoComplete,
  qIndex,
  currentQuestion,
}) {
  useEffect(() => {
    if (!active || !origin || !dest) return;
    const hasProgress = Object.keys(answers || {}).length > 0
      || questionHistory?.length > 0
      || convoComplete;
    if (!hasProgress) return;
    savePlanDraft({
      origin,
      dest,
      answers,
      questionHistory,
      convoComplete,
      qIndex,
      currentQuestionId: currentQuestion?.id ?? null,
    });
  }, [active, origin, dest, answers, questionHistory, convoComplete, qIndex, currentQuestion?.id]);
}

export { loadPlanDraft, clearPlanDraft };
