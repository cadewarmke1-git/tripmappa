import QuestionProgress from "./QuestionProgress.jsx";

/** Question-flow tab bar + Start over — visible in panel header; collapses to this row only. */
export default function PlanFlowHeaderBar({
  flowProgress,
  creditsLabel = null,
  collapsed = false,
  frozen = false,
  onResetPlan,
  onExpand,
  onCollapse,
}) {
  const showProgress = flowProgress?.phases?.length > 0;

  function handleBarClick() {
    if (collapsed) onExpand?.();
  }

  function handleBarKeyDown(e) {
    if (!collapsed) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onExpand?.();
    }
  }

  return (
    <div
      className={`plan-flow-header-bar${collapsed ? " is-collapsed" : ""}`}
      onClick={handleBarClick}
      onKeyDown={handleBarKeyDown}
      role={collapsed ? "button" : undefined}
      tabIndex={collapsed ? 0 : undefined}
      aria-expanded={!collapsed}
    >
      <div className="plan-flow-header-bar-main">
        {showProgress && (
          <div className="plan-flow-header-bar-progress">
            <QuestionProgress {...flowProgress} compact />
          </div>
        )}
        {creditsLabel && !collapsed && (
          <span className="plan-flow-credits plan-flow-header-bar-credits">{creditsLabel}</span>
        )}
      </div>
      <div className="plan-flow-header-bar-actions" onClick={e => e.stopPropagation()}>
        {!frozen && (
          <button type="button" className="convo-nav-btn plan-flow-start-over" onClick={onResetPlan}>
            Start over
          </button>
        )}
        <button
          type="button"
          className={`float-card-chevron-btn plan-flow-collapse-btn${collapsed ? "" : " open"}`}
          onClick={collapsed ? onExpand : onCollapse}
          aria-label={collapsed ? "Expand plan panel" : "Collapse plan panel to show map"}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
