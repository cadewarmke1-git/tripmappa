import { dedupeQuestionHistoryById, formatFlowAnswer } from "../lib/tripFlow.js";
import { getQuestionFlowSidebarLabel } from "../lib/questionFlowSidebar.js";

export default function QuestionAnswerSidebar({
  history = [],
  variant = "flow",
  onEditQuestion,
  assumedLodging = null,
  onEditAssumedLodging,
}) {
  if (!history.length && !assumedLodging) return null;

  return (
    <aside
      className={`plan-flow-answer-sidebar plan-flow-answer-sidebar--${variant}`}
      aria-label="Your answers so far"
    >
      {dedupeQuestionHistoryById(history).map((entry) => {
        const qId = entry.question?.id;
        const value = formatFlowAnswer(entry.question, entry.answer);
        if (!value || value === "—") return null;
        return (
          <div
            className="plan-flow-answer-sidebar-item"
            key={qId ?? "q"}
          >
            <span className="plan-flow-answer-sidebar-label">
              {getQuestionFlowSidebarLabel(entry.question)}
            </span>
            <span className="plan-flow-answer-sidebar-value">{value}</span>
            {onEditQuestion && qId && (
              <button
                type="button"
                className="plan-flow-answer-sidebar-edit"
                onClick={() => onEditQuestion(qId)}
              >
                Edit
              </button>
            )}
          </div>
        );
      })}
      {assumedLodging && (
        <div className="plan-flow-answer-sidebar-item plan-flow-answer-sidebar-item--assumed">
          <span className="plan-flow-answer-sidebar-label">LODGING</span>
          <span className="plan-flow-answer-sidebar-value">
            {assumedLodging.lodging}
            <span className="plan-flow-answer-sidebar-assumed-tag">assumed</span>
          </span>
          {onEditAssumedLodging && (
            <button
              type="button"
              className="plan-flow-answer-sidebar-edit"
              onClick={onEditAssumedLodging}
            >
              Edit
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
