/** Monthly / annual billing switch with savings badge on annual. */
export default function BillingToggle({ value, onChange, className = "" }) {
  return (
    <div className={`billing-toggle${className ? ` ${className}` : ""}`} role="group" aria-label="Billing period">
      <button
        type="button"
        className={`billing-toggle-btn${value === "month" ? " is-active" : ""}`}
        onClick={() => onChange("month")}
        aria-pressed={value === "month"}
      >
        Monthly
      </button>
      <button
        type="button"
        className={`billing-toggle-btn billing-toggle-btn--annual${value === "year" ? " is-active" : ""}`}
        onClick={() => onChange("year")}
        aria-pressed={value === "year"}
      >
        Annual
        <span className="billing-savings-badge">2 months free</span>
      </button>
    </div>
  );
}
