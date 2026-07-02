/** v0 plan-flow option tile — gold left-accent rule, icon tile, checkmark when selected. */
export default function PlanOptionCard({
  label,
  description = null,
  icon = null,
  selected = false,
  disabled = false,
  onSelect,
  className = "",
}) {
  return (
    <button
      type="button"
      className={`plan-option-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="plan-option-card-accent" aria-hidden="true" />
      {icon ? (
        <span className={`plan-option-card-icon${selected ? " is-selected" : ""}`} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="plan-option-card-text">
        <span className="plan-option-card-label">{label}</span>
        {description ? (
          <span className="plan-option-card-desc">{description}</span>
        ) : null}
      </span>
      {selected ? (
        <span className="plan-option-card-check" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
            <path d="M3.5 8.2 6.4 11 12.5 4.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}
