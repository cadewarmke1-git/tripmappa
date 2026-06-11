import { splitTripTips, tipsForDisplay } from "../../lib/tripTips.js";

/** At most one structured action tip in the fixed top region. */
export default function ResultsActionTipAlert({
  tips = [],
  onAcceptActionTip,
  onDismissActionTip,
  dismissedActionIds = [],
}) {
  const display = tipsForDisplay(tips);
  const { action } = splitTripTips(display);
  let visible = null;
  let visibleIndex = -1;
  action.forEach((t, i) => {
    if (visible) return;
    if (!dismissedActionIds.includes(`${i}-${t.title}`)) {
      visible = t;
      visibleIndex = i;
    }
  });
  if (!visible) return null;

  const id = `${visibleIndex}-${visible.title}`;

  return (
    <div className="results-action-tip-alert trip-tip-action-card" role="alert">
      <div className="trip-tip-action-title">{visible.title}</div>
      {visible.detail && <p className="trip-tip-action-detail">{visible.detail}</p>}
      <div className="trip-tip-action-buttons">
        <button
          type="button"
          className="trip-tip-action-accept"
          onClick={() => onAcceptActionTip?.(visible)}
        >
          {visible.action?.label || "Update trip"}
        </button>
        <button
          type="button"
          className="trip-tip-action-dismiss"
          onClick={() => onDismissActionTip?.(id)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
