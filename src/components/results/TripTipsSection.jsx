import { useMemo, useState } from "react";
import { pickDefaultExpandedTips, tipsForDisplay } from "../../lib/tripTips.js";

function tipKey(tip) {
  return `${tip.severity}:${tip.title}:${tip.detail}`;
}

/**
 * Results-panel trip tips from plan-trip `tips[]` (normalized tripTips state).
 * Styles live in tripmappa.css (.trip-tips-*).
 */
export default function TripTipsSection({ tips = [] }) {
  const displayTips = useMemo(() => tipsForDisplay(tips), [tips]);
  const { expanded, collapsed } = useMemo(
    () => pickDefaultExpandedTips(displayTips),
    [displayTips],
  );
  const [showMore, setShowMore] = useState(false);

  if (!displayTips.length) return null;

  const visible = showMore ? [...expanded, ...collapsed] : expanded;
  const moreCount = collapsed.length;

  return (
    <section className="trip-tips-section" aria-label="Trip tips">
      <div className="trip-tips-header">
        <h3 className="trip-tips-title">Trip tips</h3>
      </div>
      <ul className="trip-tips-list">
        {visible.map((tip) => (
          <li key={tipKey(tip)} className={tip.severity === "action" ? "trip-tip-action-card" : "trip-tip-default-card"}>
            <div className={tip.severity === "action" ? "trip-tip-action-title" : "trip-tip-default-title"}>
              {tip.title}
            </div>
            {tip.detail ? (
              <p className={tip.severity === "action" ? "trip-tip-action-detail" : "trip-tip-default-detail"}>
                {tip.detail}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {moreCount > 0 && !showMore ? (
        <button
          type="button"
          className="trip-tips-more-toggle"
          onClick={() => setShowMore(true)}
        >
          Show {moreCount} more tip{moreCount === 1 ? "" : "s"}
        </button>
      ) : null}
    </section>
  );
}
