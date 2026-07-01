/** Sole action surface during question flow — Back, Continue, Skip. */
export default function PlanFlowActionDock({ actions, onStartOver }) {
  if (!actions?.visible) return null;

  const {
    showBack,
    onBack,
    showContinue,
    continueLabel = "Continue",
    continueDisabled,
    onContinue,
    showSkip,
    skipLabel = "Skip",
    onSkip,
    showStartOver,
  } = actions;

  return (
    <div className="plan-flow-action-dock plan-panel-dock" role="group" aria-label="Plan step actions">
      <div className="plan-flow-action-dock-row">
        {showStartOver && onStartOver && (
          <button type="button" className="plan-flow-dock-btn plan-flow-dock-start-over" onClick={onStartOver}>
            Start over
          </button>
        )}
        {showBack && onBack && (
          <button type="button" className="plan-flow-dock-btn plan-flow-dock-back" onClick={onBack}>
            ← Back
          </button>
        )}
        <div className="plan-flow-action-dock-primary">
          {showSkip && onSkip && (
            <button type="button" className="plan-flow-dock-btn plan-flow-dock-skip" onClick={onSkip}>
              {skipLabel}
            </button>
          )}
          {showContinue && onContinue && (
            <button
              type="button"
              className="btn-generate plan-flow-dock-continue"
              disabled={continueDisabled}
              onClick={onContinue}
            >
              {continueLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
