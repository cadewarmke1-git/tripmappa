import PersonalTouchIcon from "../icons/PersonalTouchIcon.jsx";
import { buildPlannedHighlights } from "../../lib/personalTouches.js";

export default function PlannedForYouSection({ touches = [] }) {
  const highlights = buildPlannedHighlights(touches, 3);
  if (!highlights.length) return null;

  return (
    <section className="planned-for-you" aria-label="Planned for you">
      <div className="planned-for-you-accent" aria-hidden="true" />
      <h3 className="planned-for-you-title">Planned for you</h3>
      <ul className="planned-for-you-list planned-for-you-highlights">
        {highlights.map((item, i) => (
          <li key={`planned-${i}-${item.text.slice(0, 20)}`} className="planned-for-you-highlight">
            <PersonalTouchIcon type={item.iconType} />
            <span className="planned-for-you-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
