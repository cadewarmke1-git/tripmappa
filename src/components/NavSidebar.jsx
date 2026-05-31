import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function NavSidebar({
  open,
  closing,
  onClose,
  theme: themeProp,
  onThemeToggle: onThemeToggleProp,
  showThemeToggle = true,
  onOpenPlan,
  onOpenTrips,
  onOpenShare,
  activeNav = null,
  user = null,
  onLogin,
  onSignup,
}) {
  const { theme: contextTheme, toggleTheme: contextToggleTheme } = useTheme();
  const theme = themeProp ?? contextTheme;
  const onThemeToggle = onThemeToggleProp ?? contextToggleTheme;
  const visible = open || closing;

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!visible) return null;

  const navItems = [
    { id: "plan", label: "Plan", action: onOpenPlan },
    { id: "trips", label: "Trips", action: onOpenTrips },
    { id: "share", label: "Share", action: onOpenShare },
  ];

  function handleNav(action) {
    action?.();
  }

  return createPortal(
    <>
      <button
        type="button"
        className={`app-sidebar-overlay app-sidebar-overlay-left${open && !closing ? " is-visible" : ""}${closing ? " is-closing" : ""}`}
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <aside
        className={`nav-sidebar${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="nav-sidebar-glow" aria-hidden="true" />
        <div className="nav-sidebar-header">
          <h2 className="nav-sidebar-title">Menu</h2>
          <button
            type="button"
            className="app-sidebar-close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="nav-sidebar-nav" aria-label="Main navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-sidebar-nav-item${activeNav === item.id ? " is-active" : ""}`}
              onClick={() => handleNav(item.action)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {!user && (onLogin || onSignup) && (
          <div className="nav-sidebar-auth">
            {onLogin && (
              <button type="button" className="nav-sidebar-auth-btn nav-sidebar-auth-btn-ghost" onClick={() => { onLogin(); onClose?.(); }}>
                Log in
              </button>
            )}
            {onSignup && (
              <button type="button" className="nav-sidebar-auth-btn nav-sidebar-auth-btn-primary" onClick={() => { onSignup(); onClose?.(); }}>
                Sign up
              </button>
            )}
          </div>
        )}

        {showThemeToggle && (
          <div className="nav-sidebar-footer">
            <div className="nav-sidebar-theme-row">
              <span className="nav-sidebar-theme-label">Appearance</span>
              <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            </div>
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
