export default function AlertIcon({ className = "" }) {
  return (
    <span className={`tm-icon tm-icon-alert ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 4.5 3.5 19h17L12 4.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </span>
  );
}
