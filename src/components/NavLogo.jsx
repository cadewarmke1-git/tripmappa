/** Clickable TripMappa wordmark — navigates home from any screen. */
export default function NavLogo({ onClick, className = "" }) {
  return (
    <button
      type="button"
      className={`nav-logo nav-logo-home${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label="TripMappa home"
    >
      Trip<span>Mappa</span>
    </button>
  );
}
