import { useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";

export default function UserNavMenu({
  user,
  profile,
  creditStatus,
  onSignOut,
  onRefreshCredits,
  onOpenProfile,
  onOpenTrips,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const displayName = getDisplayName(user, profile);
  const isPremium = creditStatus?.tier === "premium";

  useEffect(() => {
    if (!open) return;
    onRefreshCredits?.();
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onRefreshCredits]);

  function closeAnd(fn) {
    setOpen(false);
    fn?.();
  }

  return (
    <div className="user-nav-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="user-nav-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
      >
        <UserAvatar user={user} profile={profile} size="md" />
        <span className="user-nav-menu-name">{displayName}</span>
        {isPremium && (
          <svg className="user-nav-menu-star" width="12" height="12" viewBox="0 0 24 24" fill="#FFD28C" aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        )}
      </button>
      {open && (
        <div className="user-nav-menu-dropdown">
          <div className="user-nav-menu-dropdown-head">
            <UserAvatar user={user} profile={profile} size="lg" showRing />
            <div>
              <div className="user-nav-menu-dropdown-name">{displayName}</div>
              <div className="user-nav-menu-dropdown-email">{user?.email || ""}</div>
            </div>
          </div>
          <button type="button" className="user-nav-menu-item" onClick={() => closeAnd(onOpenProfile)}>
            Profile
          </button>
          <button type="button" className="user-nav-menu-item" onClick={() => closeAnd(onOpenTrips)}>
            My Trips
          </button>
          <div className="user-nav-menu-divider" />
          <button
            type="button"
            className="user-nav-menu-item user-nav-menu-signout"
            onClick={() => closeAnd(onSignOut)}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
