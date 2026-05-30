import { useState } from "react";
import { buildTripConstraints } from "../../lib/tripConstraintsSummary.js";

export default function TripConstraintsBar({ answers, routeInfo }) {
  const [open, setOpen] = useState(false);
  const items = buildTripConstraints(answers, routeInfo);
  if (items.length <= 1) return null;

  return (
    <div className="trip-constraints-bar">
      <button
        type="button"
        className="trip-constraints-toggle"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        Your trip constraints ({items.length})
        <span className="trip-constraints-chevron">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="trip-constraints-list">
          {items.map(item => (
            <li key={item.id}>
              <span className="trip-constraints-label">{item.label}</span>
              <span className="trip-constraints-value">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
