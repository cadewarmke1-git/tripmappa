/** Unified v0-spec stop card — food, fuel, lodging, and general results rows. */

import { useCardTilt } from "../../hooks/useCardTilt.js";

const ACTION_ICONS = {
  "Get directions": "navigation",
  Navigate: "navigation",
  Menu: "book",
  Website: "globe",
  "Choose stay": "bed",
  "View listing": "globe",
  "Add to route": "plus",
  "On your route": "check",
};

function StopCardIcon({ name }) {
  const common = { className: "road-trip-stop-card-btn-icon", "aria-hidden": true };
  switch (name) {
    case "navigation":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11l19-9-9 19-2-8-8-2z" strokeLinejoin="round" />
        </svg>
      );
    case "book":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      );
    case "globe":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      );
    case "bed":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 4v16M2 8h18a2 2 0 012 2v10M2 17h20M6 8v9" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    default:
      return null;
  }
}

function MapPinIcon() {
  return (
    <svg className="road-trip-stop-card-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function renderStopCardAction(action) {
  const iconKey = ACTION_ICONS[action.label];
  const isPrimary = action.variant === "primary";
  const classNames = [
    "road-trip-stop-card-btn",
    isPrimary ? "road-trip-stop-card-btn--primary" : "road-trip-stop-card-btn--secondary",
    action.disabled ? "road-trip-stop-card-btn--disabled" : "",
  ].filter(Boolean).join(" ");

  const content = (
    <>
      {iconKey ? <StopCardIcon name={iconKey} /> : null}
      {action.label}
    </>
  );

  if (action.href && !action.disabled) {
    return (
      <a
        key={action.label}
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={classNames}
        title={action.title}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      key={action.label}
      type="button"
      className={classNames}
      disabled={action.disabled}
      title={action.title}
      onClick={e => {
        e.stopPropagation();
        action.onClick?.(e);
      }}
    >
      {content}
    </button>
  );
}

/**
 * @typedef {Object} StopCardAction
 * @property {string} label
 * @property {"primary"|"secondary"} [variant]
 * @property {() => void} [onClick]
 * @property {string} [href]
 * @property {boolean} [disabled]
 * @property {string} [title]
 */

export default function RoadTripStopCard({
  signCategory = "general",
  categoryLabel,
  name,
  photo = null,
  rating = null,
  distance = null,
  verified = false,
  metaExtra = null,
  actions = [],
  children = null,
  onCardClick = null,
  highlighted = false,
  cardRef = null,
  className = "",
  ariaLabel = null,
  staggerIndex = null,
  cardEnter = false,
}) {
  const catClass = `road-trip-stop-card--${signCategory}`;
  const {
    ref: tiltRef,
    style: tiltStyle,
    hovering: tiltHovering,
    tiltEnabled,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
  } = useCardTilt(cardRef);

  const hasMeta = rating != null || distance || verified || metaExtra;

  const metaSegments = [];
  if (rating != null) {
    metaSegments.push(
      <span key="rating" className="road-trip-stop-card-rating" aria-label={`Rated ${rating} out of 5`}>
        ★ {Number(rating).toFixed(1)}
      </span>,
    );
  }
  if (verified) {
    metaSegments.push(
      <span key="verified" className="road-trip-stop-card-verified" title="Verified on Google Maps">
        ✓ Verified
      </span>,
    );
  }
  if (distance) {
    metaSegments.push(
      <span key="distance" className="road-trip-stop-card-distance">
        <MapPinIcon />
        <span>{distance}</span>
      </span>,
    );
  }
  if (metaExtra) {
    metaSegments.push(<span key="extra" className="road-trip-stop-card-meta-extra">{metaExtra}</span>);
  }

  return (
    <article
      ref={tiltRef}
      style={{
        ...tiltStyle,
        ...(staggerIndex != null ? { "--stagger-index": staggerIndex } : {}),
      }}
      className={`road-trip-stop-card road-stop-card results-place-card ${catClass}${highlighted ? " stop-highlighted" : ""}${tiltEnabled ? " road-trip-stop-card--tilt" : ""}${tiltHovering ? " is-tilt-hover" : ""}${cardEnter ? " results-stop-card-enter" : ""}${className ? ` ${className}` : ""}`}
      onClick={onCardClick}
      onKeyDown={e => { if (e.key === "Enter") onCardClick?.(); }}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      aria-label={ariaLabel || name}
    >
      <div className="road-trip-stop-card-thumb road-stop-card-photo-wrap road-stop-card-photo-thumb">
        {photo}
      </div>

      <div className="road-trip-stop-card-body road-stop-card-body">
        {categoryLabel && (
          <span className="road-trip-stop-card-category road-stop-card-cat-label">{categoryLabel}</span>
        )}

        <h3 className="road-trip-stop-card-name road-stop-card-name">{name}</h3>

        {hasMeta && (
          <p className="road-trip-stop-card-meta road-stop-card-meta">
            {metaSegments.map((segment, index) => (
              <span key={segment.key} className="road-trip-stop-card-meta-item">
                {index > 0 && <span className="road-trip-stop-card-sep" aria-hidden>·</span>}
                {segment}
              </span>
            ))}
          </p>
        )}

        {actions.length > 0 && (
          <div className="road-trip-stop-card-actions road-stop-card-actions">
            {actions.map(renderStopCardAction)}
          </div>
        )}

        {children}
      </div>
    </article>
  );
}
