/** Shared horizontal results row — road stops, lodging, restaurants. */
export default function ResultsPlaceCard({
  signCategory = "general",
  categoryLabel,
  name,
  photo,
  verifiedBadge = null,
  meta = null,
  action = null,
  onClick,
  className = "",
  cardRef,
  highlighted = false,
  ariaLabel,
  children,
}) {
  return (
    <article
      ref={cardRef}
      className={`results-place-card results-place-card--${signCategory} road-stop-card road-stop-card--${signCategory}${highlighted ? " stop-highlighted" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter") onClick?.(); }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
    >
      <div className="road-stop-card-photo-wrap road-stop-card-photo-thumb">
        {photo}
        {verifiedBadge}
      </div>
      <div className="road-stop-card-body">
        <div className="road-stop-card-header">
          {categoryLabel && <span className="road-stop-card-cat-label">{categoryLabel}</span>}
          <h4 className="road-stop-card-name">{name}</h4>
        </div>
        {meta}
        {action}
        {children}
      </div>
    </article>
  );
}
