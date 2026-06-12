import { formatFlowAnswer } from "../lib/tripFlow.js";
import { getQuestionFlowSidebarLabel } from "../lib/questionFlowSidebar.js";

export default function QuestionAnswerSidebar({
  history = [],
  variant = "flow",
  onEditQuestion,
}) {
  if (!history.length) return null;

  return (
    <aside
      className={`plan-flow-answer-sidebar plan-flow-answer-sidebar--${variant}`}
      aria-label="Your answers so far"
    >
      {history.map((entry, index) => {
        const qId = entry.question?.id;
        const value = formatFlowAnswer(entry.question, entry.answer);
        if (!value || value === "—") return null;
        return (
          <div
            className="plan-flow-answer-sidebar-item"
            key={`${qId ?? "q"}-${index}`}
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
    </aside>
  );
}
