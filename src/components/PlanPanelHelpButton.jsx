export default function PlanPanelHelpButton({
  open,
  onToggle,
  onHelpCenter,
  onReportIssue,
  onMapTips,
  wrapRef,
}) {
  return (
    <div className="float-card-help-wrap" ref={wrapRef}>
      <button
        type="button"
        className="float-card-help-btn"
        onClick={onToggle}
        aria-label="Help — open menu for help center and reporting issues"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ?
      </button>
      {open && (
        <div className="help-menu" role="menu">
          {onMapTips && (
            <button type="button" className="help-menu-item" role="menuitem" onClick={onMapTips}>
              Map tips
            </button>
          )}
          <button type="button" className="help-menu-item" role="menuitem" onClick={onHelpCenter}>
            Help center
          </button>
          <button type="button" className="help-menu-item" role="menuitem" onClick={onReportIssue}>
            Report an issue
          </button>
        </div>
      )}
    </div>
  );
}
