/** Three-line hamburger control for the main navigation sidebar. */
export default function HamburgerMenuButton({ isOpen = false, onClick, className = "" }) {
  return (
    <button
      type="button"
      className={`hamburger-menu-btn${isOpen ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
    >
      <span className="hamburger-menu-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </button>
  );
}
