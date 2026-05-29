const DEFAULT_PHASES = [
  { id: "about", label: "Your trip" },
  { id: "route", label: "Route" },
  { id: "details", label: "Details" },
  { id: "done", label: "Ready" },
];

export default function QuestionProgress({
  phases = DEFAULT_PHASES,
  currentPhaseId = "about",
  progressPercent = 0,
  compact = false,
}) {
  if (!phases?.length) return null;

  const activeIndex = Math.max(0, phases.findIndex(p => p.id === currentPhaseId));

  return (
    <div className={`question-progress${compact ? " question-progress-compact" : ""}`}>
      <div className="question-progress-track">
        <div
          className="question-progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
      <div className="question-progress-phases" role="list" aria-label="Planning progress">
        {phases.map((phase, index) => (
          <span
            key={phase.id}
            role="listitem"
            className={`question-progress-phase${index < activeIndex ? " is-done" : ""}${index === activeIndex ? " is-active" : ""}`}
          >
            {phase.label}
          </span>
        ))}
      </div>
    </div>
  );
}
