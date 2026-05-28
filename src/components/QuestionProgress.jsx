export default function QuestionProgress({ currentStep, totalSteps, progressPercent, compact = false }) {
  if (!totalSteps || totalSteps <= 0) return null;

  return (
    <div className={`question-progress${compact ? " question-progress-compact" : ""}`}>
      <div className="question-progress-track">
        <div className="question-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
      </div>
      <div className="question-progress-label">
        Step {Math.min(currentStep, totalSteps)} of {totalSteps}
      </div>
    </div>
  );
}
