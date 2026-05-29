import { useEffect } from "react";
import { createPortal } from "react-dom";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { getTierLabel, normalizeTier, TIERS } from "../lib/tiers.js";

export default function AccountSidebar({
  open,
  closing,
  onClose,
  user,
  profile,
  creditStatus,
  onRefreshCredits,
  onOpenProfile,
  onOpenTrips,
  onOpenShare,
  onOpenSettings,
  onSignOut,
  activeNav = null,
}) {
  const displayName = getDisplayName(user, profile);
  const tierKey = normalizeTier(creditStatus?.tier);
  const tierLabel = getTierLabel(tierKey).toUpperCase();
  const tierClass = tierKey === TIERS.TRAVELER ? "traveler" : tierKey === TIERS.PREMIUM ? "premium" : "free";

  const creditsLine = creditStatus?.unlimited
    ? "Unlimited Trip Generations this month"
    : creditStatus?.tier === "guest"
      ? `${creditStatus.remaining ?? 1} Trip Generation remaining`
      : creditStatus != null
        ? `${creditStatus.remaining ?? 0} of ${creditStatus.limit ?? 3} Trip Generations remaining this month`
        : "Loading Trip Generations…";

  const visible = open || closing;

  useEffect(() => {
    if (!open) return undefined;
    onRefreshCredits?.();
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
  }, [open, onRefreshCredits, onClose]);

  if (!visible) return null;

  function handleNav(action) {
    action?.();
  }

  const navItems = [
    { id: "profile", label: "Profile", action: onOpenProfile },
    { id: "trips", label: "Trips", action: onOpenTrips },
    { id: "share", label: "Share", action: onOpenShare },
    { id: "settings", label: "Settings", action: onOpenSettings },
  ];

  return createPortal(
    <>
      <button
        type="button"
        className={`account-sidebar-overlay${open && !closing ? " is-visible" : ""}${closing ? " is-closing" : ""}`}
        aria-label="Close account menu"
        onClick={onClose}
      />
      <aside
        className={`account-sidebar${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
      >
        <div className="account-sidebar-glow" aria-hidden="true" />
        <div className="account-sidebar-header">
          <h2 className="account-sidebar-title">Account</h2>
          <button
            type="button"
            className="account-sidebar-close"
            onClick={onClose}
            aria-label="Close account menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="account-sidebar-identity"
          onClick={() => handleNav(onOpenProfile)}
        >
          <UserAvatar user={user} profile={profile} size={64} showRing className="account-sidebar-avatar" />
          <div className="account-sidebar-name">{displayName}</div>
          <div className="account-sidebar-email">{user?.email || ""}</div>
        </button>

        <div className="account-sidebar-meta">
          <span className={`profile-card-tier profile-card-tier--${tierClass}`}>
            {tierLabel}
          </span>
          <p className="profile-card-credits">{creditsLine}</p>
        </div>

        <nav className="account-sidebar-nav" aria-label="Account navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`account-sidebar-nav-item${activeNav === item.id ? " is-active" : ""}`}
              onClick={() => handleNav(item.action)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="profile-card-signout account-sidebar-signout"
          onClick={() => handleNav(onSignOut)}
        >
          Sign Out
        </button>
      </aside>
    </>,
    document.body,
  );
}
