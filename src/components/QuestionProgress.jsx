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
  stepIndex = null,
  stepTotal = null,
  phaseLabel = null,
  compact = false,
  showStepSubtitle = false,
  trackOnly = false,
}) {
  if (!phases?.length) return null;

  const activeIndex = Math.max(0, phases.findIndex(p => p.id === currentPhaseId));
  const resolvedStep = stepIndex ?? activeIndex + 1;
  const resolvedTotal = stepTotal ?? phases.length;
  const resolvedLabel = phaseLabel ?? phases[activeIndex]?.label ?? phases[0].label;

  return (
    <div className={`question-progress${compact ? " question-progress-compact" : ""}${trackOnly ? " question-progress-track-only" : ""}`}>
      {showStepSubtitle && (
        <p className="question-progress-subtitle" aria-live="polite">
          Step {resolvedStep} of {resolvedTotal} · {resolvedLabel}
        </p>
      )}
      <div className="question-progress-track">
        <div
          className="question-progress-fill"
          style={{ "--progress": `${Math.min(100, Math.max(0, progressPercent)) / 100}` }}
        />
      </div>
      {!trackOnly && (
        <div className="question-progress-phases" role="list" aria-label="Planning progress">
          {phases.map((phase, index) => (
            <span
              key={phase.id}
              role="listitem"
              aria-current={index === activeIndex ? "step" : undefined}
              className={`question-progress-phase${index < activeIndex ? " is-done" : ""}${index === activeIndex ? " is-active" : ""}${index > activeIndex ? " is-upcoming" : ""}`}
            >
              {phase.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
