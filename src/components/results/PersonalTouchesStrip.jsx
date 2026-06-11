import PersonalTouchIcon from "../icons/PersonalTouchIcon.jsx";
import { getPersonalTouchIconType, normalizePersonalTouches } from "../../lib/personalTouches.js";

/** Compact single-row personal touches — same copy, compressed presentation. */
export default function PersonalTouchesStrip({ touches = [], changesMade = [], className = "" }) {
  const visibleTouches = normalizePersonalTouches(touches);
  const visibleChanges = normalizePersonalTouches(changesMade);
  if (!visibleTouches.length) return null;

  return (
    <section className={`personal-touches-strip${className ? ` ${className}` : ""}`} aria-label="Planned for you">
      <div className="personal-touches-strip-scroll">
        <ul className="personal-touches-strip-list">
          {visibleTouches.map((line, i) => (
            <li key={`touch-${i}-${line.slice(0, 20)}`} className="personal-touches-strip-pill">
              <span className="personal-touches-gold-dot" aria-hidden="true" />
              <PersonalTouchIcon type={getPersonalTouchIconType(line)} />
              <span className="personal-touches-strip-text">{line}</span>
            </li>
          ))}
          {visibleChanges.map((line, i) => (
            <li key={`change-${i}-${line.slice(0, 20)}`} className="personal-touches-strip-pill personal-touches-strip-pill-muted">
              <span className="personal-touches-gold-dot" aria-hidden="true" />
              <PersonalTouchIcon type="refresh" />
              <span className="personal-touches-strip-text">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
