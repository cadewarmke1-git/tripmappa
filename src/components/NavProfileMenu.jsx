import { useCallback, useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";
import { getAvatarTierBadge } from "../lib/tiers.js";

export default function NavProfileMenu({
  user,
  profile,
  creditStatus = null,
  activeNav = null,
  heroTheme = null,
  onOpenPlan,
  onOpenTrips,
  onOpenShare,
  onOpenProfile,
  onRefreshCredits,
  onUploadAvatar,
  onGetStarted,
  onSignIn,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);
  const photoInputRef = useRef(null);

  const isSignedIn = Boolean(user?.id);
  const displayName = isSignedIn ? getDisplayName(user, profile) : "Welcome to TripMappa";
  const heroPalette = heroTheme ? HERO_SURFACE_PALETTE[heroTheme] : null;
  const tierBadge = isSignedIn ? getAvatarTierBadge(creditStatus?.tier || profile?.tier) : null;

  const closeMenu = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setClosing(false);
    }, 220);
  }, [open, closing]);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setClosing(false);
    setOpen(true);
  }, []);

  const run = useCallback((action) => {
    closeMenu();
    action?.();
  }, [closeMenu]);

  const handleSignOutClick = useCallback(async () => {
    closeMenu();
    try {
      await onSignOut?.();
    } catch {
      // Parent surfaces errors via toast
    }
  }, [closeMenu, onSignOut]);

  useEffect(() => {
    if (!open) return undefined;
    if (isSignedIn) onRefreshCredits?.();
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onRefreshCredits, closeMenu, isSignedIn]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingPhoto(true);
    try {
      await onUploadAvatar?.(file);
    } finally {
      setUploadingPhoto(false);
    }
  }

  const navItems = [
    { id: "plan", label: "Plan", action: onOpenPlan },
    { id: "trips", label: "Trips", action: onOpenTrips },
    { id: "share", label: "Share", action: onOpenShare },
  ];

  const showDropdown = open || closing;
  const triggerLabel = isSignedIn ? `Profile menu for ${displayName}` : "Open menu";

  return (
    <div className="profile-card-menu" ref={wrapRef}>
      <button
        type="button"
        className={`profile-card-trigger${open ? " is-active" : ""}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
      >
        <UserAvatar
          user={user}
          profile={profile}
          size="md"
          showRing
          tierBadge={tierBadge}
          className="profile-card-trigger-avatar"
          heroPalette={heroPalette}
        />
      </button>

      {showDropdown && (
        <div
          className={`profile-card-dropdown${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
          role="dialog"
          aria-label="Navigation menu"
        >
          <div className="profile-card-dropdown-glow" aria-hidden="true" />

          <div className="profile-card-identity profile-card-identity--static">
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
            {isSignedIn ? (
              <div className="profile-card-email">{user?.email || ""}</div>
            ) : (
              <div className="profile-card-email profile-card-guest-tag">Sign in to save trips & sync plans</div>
            )}
          </div>

          <hr className="profile-card-dropdown-divider" />

          <nav className="profile-card-nav" aria-label="Main navigation">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                className={`profile-card-nav-link${activeNav === item.id ? " is-active" : ""}`}
                onClick={() => run(item.action)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <hr className="profile-card-dropdown-divider" />

          <div className="profile-card-account-actions">
            {isSignedIn ? (
              <>
                <button
                  type="button"
                  className="profile-card-nav-link profile-card-nav-link--account"
                  onClick={() => run(onOpenProfile)}
                >
                  View profile
                </button>
                <button
                  type="button"
                  className="profile-card-signout"
                  onClick={() => void handleSignOutClick()}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="profile-card-nav-link profile-card-nav-link--cta"
                  onClick={() => run(onGetStarted)}
                >
                  Get Started
                </button>
                <button
                  type="button"
                  className="profile-card-nav-link profile-card-nav-link--account"
                  onClick={() => run(onSignIn)}
                >
                  Sign In
                </button>
              </>
            )}
          </div>

          {isSignedIn && (
            <>
              <hr className="profile-card-dropdown-divider" />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="profile-card-photo-input"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handlePhotoChange}
              />
              <button
                type="button"
                className="profile-card-photo-btn"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploadingPhoto ? "Uploading…" : "Change Profile Photo"}
              </button>
            </>
          )}

          <hr className="profile-card-dropdown-divider" />

          <nav className="profile-card-dropdown-legal" aria-label="Legal">
            <a href="/privacy" onClick={closeMenu}>Privacy Policy</a>
            <a href="/terms" onClick={closeMenu}>Terms of Service</a>
          </nav>
        </div>
      )}
    </div>
  );
}
