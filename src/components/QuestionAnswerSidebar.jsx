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

  const items = dedupeQuestionHistoryById(history)
    .map((entry) => {
      const qId = entry.question?.id;
      const value = formatFlowAnswer(entry.question, entry.answer);
      if (!value || value === "—") return null;
      return {
        key: qId ?? "q",
        qId,
        label: getQuestionFlowSidebarLabel(entry.question),
        value,
      };
    })
    .filter(Boolean);

  if (variant === "summary") {
    return (
      <section className="plan-flow-answer-summary" aria-label="Your trip answers">
        <h3 className="plan-flow-answer-summary-heading">Your answers</h3>
        <ul className="plan-flow-answer-summary-list">
          {items.map(({ key, qId, label, value }) => (
            <li className="plan-flow-answer-summary-item" key={key}>
              <span className="plan-flow-answer-summary-label">{label}</span>
              <span className="plan-flow-answer-summary-value">
                {value}
                {onEditQuestion && qId && (
                  <button
                    type="button"
                    className="plan-flow-answer-summary-edit"
                    onClick={() => onEditQuestion(qId)}
                  >
                    Edit
                  </button>
                )}
              </span>
            </li>
          ))}
          {assumedLodging && (
            <li className="plan-flow-answer-summary-item plan-flow-answer-summary-item--assumed">
              <span className="plan-flow-answer-summary-label">Lodging</span>
              <span className="plan-flow-answer-summary-value">
                {assumedLodging.lodging}
                <span className="plan-flow-answer-summary-tag">assumed</span>
                {onEditAssumedLodging && (
                  <button
                    type="button"
                    className="plan-flow-answer-summary-edit"
                    onClick={onEditAssumedLodging}
                  >
                    Edit
                  </button>
                )}
              </span>
            </li>
          )}
        </ul>
      </section>
    );
  }

  return (
    <div
      className={`plan-flow-picks-strip plan-flow-picks-strip--${variant}`}
      aria-label="Your answers so far"
    >
      <div className="plan-flow-picks-strip-scroll">
        {items.map(({ key, qId, label, value }) => (
          <div className="plan-flow-pick-chip" key={key}>
            <span className="plan-flow-pick-chip-label">{label}</span>
            <span className="plan-flow-pick-chip-value">{value}</span>
            {onEditQuestion && qId && (
              <button
                type="button"
                className="plan-flow-pick-chip-edit"
                onClick={() => onEditQuestion(qId)}
              >
                Edit
              </button>
            )}
          </div>
        ))}
        {assumedLodging && (
          <div className="plan-flow-pick-chip plan-flow-pick-chip--assumed">
            <span className="plan-flow-pick-chip-label">Lodging</span>
            <span className="plan-flow-pick-chip-value">
              {assumedLodging.lodging}
              <span className="plan-flow-pick-chip-tag">assumed</span>
            </span>
            {onEditAssumedLodging && (
              <button
                type="button"
                className="plan-flow-pick-chip-edit"
                onClick={onEditAssumedLodging}
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
