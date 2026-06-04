import { useState } from "react";

export default function PlanPanelHelpButton({
  open,
  onToggle,
  onHelpCenter,
  onReportIssue,
  wrapRef,
}) {
  const [tipVisible, setTipVisible] = useState(false);

  function showTip() {
    setTipVisible(true);
  }

  function hideTip() {
    setTipVisible(false);
  }

  return (
    <div
      className={`float-card-help-wrap${tipVisible ? " is-tip-visible" : ""}`}
      ref={wrapRef}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
    >
      <button
        type="button"
        className="float-card-help-btn"
        onClick={() => {
          onToggle?.();
          hideTip();
        }}
        onTouchStart={() => setTipVisible(true)}
        aria-label="Help — open menu for help center and reporting issues"
        aria-expanded={open}
        aria-describedby="plan-panel-help-tip"
      >
        ?
        <span className="float-card-help-tooltip" id="plan-panel-help-tip" role="tooltip">
          Open help options: visit the help center or report an issue with your trip plan.
        </span>
      </button>
      {open && (
        <div className="help-menu">
          <button type="button" className="help-menu-item" onClick={onHelpCenter}>
            Help center
          </button>
          <button type="button" className="help-menu-item" onClick={onReportIssue}>
            Report an issue
          </button>
        </div>
      )}
    </div>
  );
}
