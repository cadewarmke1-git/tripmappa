/** Small four-point mark used in empty states and celebration UI. */
export default function DecorMark({ className = "" }) {
  return (
    <span className={`tm-icon tm-icon-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </span>
  );
}
