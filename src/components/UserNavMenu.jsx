import { useEffect, useRef, useState, useCallback } from "react";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";

export default function UserNavMenu({
  user,
  profile,
  creditStatus,
  onSignOut,
  onRefreshCredits,
  onOpenProfile,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);

  const displayName = getDisplayName(user, profile);
  const isPremium = creditStatus?.tier === "premium";
  const tierLabel = isPremium ? "PREMIUM" : "FREE";

  const creditsLine = creditStatus?.unlimited
    ? "Unlimited AI trips this month"
    : creditStatus?.tier === "guest"
      ? `${creditStatus.remaining ?? 1} free trip remaining`
      : creditStatus != null
        ? `${creditStatus.remaining ?? 0} of ${creditStatus.limit ?? 3} AI trips left this month`
        : "Loading trip credits…";

  const closeMenu = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    setOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setClosing(false);
    }, 220);
  }, [open, closing]);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setClosing(false);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    onRefreshCredits?.();
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onRefreshCredits, closeMenu]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  function handleSignOut() {
    closeMenu();
    onSignOut?.();
  }

  function handleOpenProfile() {
    closeMenu();
    onOpenProfile?.();
  }

  const showDropdown = open || closing;

  return (
    <div className="profile-card-menu" ref={wrapRef}>
      <button
        type="button"
        className={`profile-card-trigger${open ? " is-active" : ""}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Profile menu for ${displayName}`}
      >
        <UserAvatar user={user} profile={profile} size="md" showRing className="profile-card-trigger-avatar" />
      </button>

      {showDropdown && (
        <div
          className={`profile-card-dropdown${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
          role="dialog"
          aria-label="Account menu"
        >
          <div className="profile-card-dropdown-glow" aria-hidden="true" />
          <button
            type="button"
            className="profile-card-identity"
            onClick={handleOpenProfile}
          >
            <UserAvatar user={user} profile={profile} size={64} showRing className="profile-card-dropdown-avatar" />
            <div className="profile-card-name">{displayName}</div>
            <div className="profile-card-email">{user?.email || ""}</div>
          </button>

          <div className="profile-card-meta">
            <span className={`profile-card-tier profile-card-tier--${isPremium ? "premium" : "free"}`}>
              {tierLabel}
            </span>
            <p className="profile-card-credits">{creditsLine}</p>
          </div>

          <button
            type="button"
            className="profile-card-signout"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
