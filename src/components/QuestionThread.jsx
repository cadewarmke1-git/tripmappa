import { formatFlowAnswer } from "../lib/tripFlow.js";

export default function QuestionThread({ history = [] }) {
  if (!history.length) return null;

  return (
    <div className="question-thread" aria-label="Previous answers">
      {history.map((entry, index) => (
        <div className="question-thread-item" key={`${entry.question?.id}-${index}`}>
          <div className="question-thread-q">{entry.question?.ask}</div>
          <div className="question-thread-a">{formatFlowAnswer(entry.question, entry.answer)}</div>
        </div>
      ))}
    </div>
  );
}
