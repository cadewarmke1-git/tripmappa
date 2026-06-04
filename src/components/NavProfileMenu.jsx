import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import UserAvatar from "./UserAvatar.jsx";
import BrandWordmark from "./BrandWordmark.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";
import { getAvatarTierBadge } from "../lib/tiers.js";

function GuestMenuIcon({ size = 40 }) {
  return (
    <span
      className="nav-profile-menu-guest-icon"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export default function NavProfileMenu({
  user = null,
  profile = null,
  creditStatus = null,
  activeNav = null,
  heroTheme = null,
  onOpenPlan,
  onOpenTrips,
  onOpenShare,
  onSignOut,
  onGetStarted,
  onSignIn,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const wrapRef = useRef(null);
  const panelId = useId();
  const closeTimerRef = useRef(null);

  const displayName = user ? getDisplayName(user, profile) : null;
  const heroPalette = heroTheme ? HERO_SURFACE_PALETTE[heroTheme] : null;
  const tierBadge = user ? getAvatarTierBadge(creditStatus?.tier || profile?.tier) : null;

  const close = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, [open, closing]);

  const run = useCallback((action) => {
    action?.();
    close();
  }, [close]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, close]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const navItems = [
    { id: "plan", label: "Plan", action: onOpenPlan },
    { id: "trips", label: "Trips", action: onOpenTrips },
    { id: "share", label: "Share", action: onOpenShare },
  ];

  const panelVisible = open || closing;

  return (
    <div className="profile-card-menu nav-profile-menu" ref={wrapRef}>
      <button
        type="button"
        className={`profile-card-trigger${open ? " is-active" : ""}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        aria-label={user ? `Open menu for ${displayName}` : "Open TripMappa menu"}
      >
        {user ? (
          <UserAvatar
            user={user}
            profile={profile}
            size="md"
            showRing
            tierBadge={tierBadge}
            className="profile-card-trigger-avatar"
            heroPalette={heroPalette}
          />
        ) : (
          <GuestMenuIcon size={40} />
        )}
      </button>

      {panelVisible && createPortal(
        <button
          type="button"
          className={`nav-profile-menu-scrim${open && !closing ? " is-visible" : ""}`}
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
        />,
        document.body,
      )}

      {panelVisible && (
        <div
          id={panelId}
          className={`profile-card-dropdown nav-profile-menu-panel${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
          role="menu"
          aria-label={user ? "Account and navigation" : "TripMappa menu"}
        >
          <div className="profile-card-dropdown-glow" aria-hidden="true" />

          <header className="profile-card-dropdown-header">
            {user ? (
              <>
                <UserAvatar
                  user={user}
                  profile={profile}
                  size={72}
                  showRing
                  tierBadge={tierBadge}
                  className="profile-card-dropdown-avatar profile-card-dropdown-avatar--large"
                  heroPalette={heroPalette}
                />
                <div className="profile-card-name">{displayName}</div>
                <div className="profile-card-email">{user.email || ""}</div>
              </>
            ) : (
              <>
                <div className="profile-card-dropdown-guest-mark" aria-hidden="true">
                  <BrandWordmark className="profile-card-dropdown-guest-wordmark" as="span" />
                </div>
                <h2 className="profile-card-dropdown-guest-heading">Welcome to TripMappa</h2>
              </>
            )}
          </header>

          <hr className="profile-card-dropdown-divider" />

          <nav className="profile-card-nav-list" aria-label="Main navigation">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`profile-card-nav-item${activeNav === item.id ? " is-active" : ""}`}
                onClick={() => run(item.action)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <hr className="profile-card-dropdown-divider" />

          <div className="profile-card-dropdown-actions" role="group" aria-label="Account">
            {user ? (
              <button
                type="button"
                role="menuitem"
                className="profile-card-signout"
                onClick={() => run(onSignOut)}
              >
                Sign Out
              </button>
            ) : (
              <>
                {onGetStarted && (
                  <button
                    type="button"
                    role="menuitem"
                    className="profile-card-nav-item profile-card-nav-item--primary"
                    onClick={() => run(onGetStarted)}
                  >
                    Get Started
                  </button>
                )}
                {onSignIn && (
                  <button
                    type="button"
                    role="menuitem"
                    className="profile-card-nav-item"
                    onClick={() => run(onSignIn)}
                  >
                    Sign In
                  </button>
                )}
              </>
            )}
          </div>

          <hr className="profile-card-dropdown-divider" />

          <nav className="profile-card-dropdown-legal" aria-label="Legal">
            <a href="/privacy" role="menuitem" onClick={close}>Privacy Policy</a>
            <a href="/terms" role="menuitem" onClick={close}>Terms of Service</a>
          </nav>
        </div>
      )}
    </div>
  );
}
