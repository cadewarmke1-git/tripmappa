import PersonalTouchIcon from "../icons/PersonalTouchIcon.jsx";
import { getPersonalTouchIconType, normalizePersonalTouches } from "../../lib/personalTouches.js";

export default function PlannedForYouSection({ touches = [], changesMade = [] }) {
  const visibleTouches = normalizePersonalTouches(touches);
  const visibleChanges = normalizePersonalTouches(changesMade);
  if (!visibleTouches.length) return null;

  return (
    <section className="planned-for-you" aria-label="Planned for you">
      <div className="planned-for-you-accent" aria-hidden="true" />
      <h3 className="planned-for-you-title">Planned for you</h3>
      <div className="planned-for-you-scroll">
        <ul className="planned-for-you-list">
          {visibleTouches.map((line, i) => (
            <li key={`planned-${i}-${line.slice(0, 20)}`} className="planned-for-you-pill">
              <PersonalTouchIcon type={getPersonalTouchIconType(line)} />
              <span className="planned-for-you-text">{line}</span>
            </li>
          ))}
        </ul>
      </div>
      {visibleChanges.length > 0 && (
        <div className="planned-for-you-changes">
          <p className="planned-for-you-changes-label">Updated for your edits</p>
          <ul className="planned-for-you-list planned-for-you-list-compact">
            {visibleChanges.map((line, i) => (
              <li key={`change-${i}-${line.slice(0, 20)}`} className="planned-for-you-pill planned-for-you-pill-muted">
                <PersonalTouchIcon type="refresh" />
                <span className="planned-for-you-text">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
