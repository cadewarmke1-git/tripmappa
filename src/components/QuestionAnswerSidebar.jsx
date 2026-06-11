import { formatFlowAnswer } from "../lib/tripFlow.js";
import { getQuestionFlowSidebarLabel } from "../lib/questionFlowSidebar.js";

export default function QuestionAnswerSidebar({ history = [] }) {
  if (!history.length) return null;

  return (
    <aside className="plan-flow-answer-sidebar" aria-label="Your answers so far">
      {history.map((entry, index) => (
        <div
          className="plan-flow-answer-sidebar-item"
          key={`${entry.question?.id ?? "q"}-${index}`}
        >
          <span className="plan-flow-answer-sidebar-label">
            {getQuestionFlowSidebarLabel(entry.question)}
          </span>
          <span className="plan-flow-answer-sidebar-value">
            {formatFlowAnswer(entry.question, entry.answer)}
          </span>
        </div>
      ))}
    </aside>
  );
}
