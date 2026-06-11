import { useState } from "react";
import { splitTripTips, tipsForDisplay } from "../lib/tripTips.js";

export function TripTipsSection({
  tips = [],
  updatedAt = null,
  refreshing = false,
  onAcceptActionTip,
  onDismissActionTip,
  dismissedActionIds = [],
  hideActionCards = false,
}) {
  const display = tipsForDisplay(tips);
  const { action, more } = splitTripTips(display);
  const visibleActions = hideActionCards
    ? []
    : action.filter((t, i) => !dismissedActionIds.includes(`${i}-${t.title}`));
  const [moreOpen, setMoreOpen] = useState(false);

  if (!visibleActions.length && !more.length) return null;

  const updatedLabel = updatedAt
    ? formatUpdatedLabel(updatedAt, refreshing)
    : null;

  return (
    <section className="trip-tips-section" aria-label="Trip Tips">
      {visibleActions.map((tip, i) => {
        const id = `${i}-${tip.title}`;
        return (
          <div key={id} className="trip-tip-action-card" role="alert">
            <div className="trip-tip-action-title">{tip.title}</div>
            {tip.detail && <p className="trip-tip-action-detail">{tip.detail}</p>}
            <div className="trip-tip-action-buttons">
              <button
                type="button"
                className="trip-tip-action-accept"
                onClick={() => onAcceptActionTip?.(tip)}
              >
                {tip.action?.label || "Update trip"}
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
      })}

      {more.length > 0 && (
        <div className="trip-tips-more">
          <button
            type="button"
            className="trip-tips-more-toggle"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(v => !v)}
          >
            More tips ({more.length})
          </button>
          {moreOpen && (
            <ul className="trip-tips-list">
              {more.map((tip, i) => (
                <li key={`${i}-${tip.title}`} className="trip-tips-line">
                  <strong>{tip.title}</strong>
                  {tip.detail ? ` — ${tip.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {updatedLabel && <span className="trip-tips-updated">{updatedLabel}</span>}
    </section>
  );
}

function formatUpdatedLabel(updatedAt, refreshing) {
  if (refreshing) return "Updating…";
  const mins = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  return `Updated ${mins} min ago`;
}

/** Back-compat wrapper — maps legacy alert objects to structured tips. */
export default function TripAlertsBanner({
  alerts = [],
  tips,
  updatedAt,
  refreshing,
  onAcceptActionTip,
  onDismissActionTip,
  dismissedActionIds,
}) {
  const normalized = tips ?? alerts;
  return (
    <TripTipsSection
      tips={normalized}
      updatedAt={updatedAt}
      refreshing={refreshing}
      onAcceptActionTip={onAcceptActionTip}
      onDismissActionTip={onDismissActionTip}
      dismissedActionIds={dismissedActionIds}
    />
  );
}
