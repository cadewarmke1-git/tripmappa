import { useCallback, useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";
import { getTierCssClass } from "../lib/tiers.js";

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
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const photoInputRef = useRef(null);

  const isSignedIn = Boolean(user?.id);
  const wasSignedInRef = useRef(isSignedIn);
  const displayName = isSignedIn ? getDisplayName(user, profile) : "Welcome to TripMappa";
  const heroPalette = heroTheme ? HERO_SURFACE_PALETTE[heroTheme] : null;
  const tierRing = isSignedIn ? getTierCssClass(creditStatus?.tier || profile?.tier) : null;

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

    const isPointerOverPlanFlow = (event) => {
      const planFlow = document.querySelector(".float-card--plan-flow:not(.collapsed)");
      if (!planFlow) return false;
      const rect = planFlow.getBoundingClientRect();
      return (
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom
      );
    };

    const onPointerDown = (e) => {
      const target = e.target instanceof Node ? e.target : null;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) {
        if (isPointerOverPlanFlow(e)) closeMenu();
        return;
      }
      closeMenu();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onRefreshCredits, closeMenu, isSignedIn]);

  useEffect(() => {
    if (isSignedIn && !wasSignedInRef.current && open) closeMenu();
    wasSignedInRef.current = isSignedIn;
  }, [isSignedIn, open, closeMenu]);

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

  function openPhotoPicker(e) {
    e.preventDefault();
    e.stopPropagation();
    photoInputRef.current?.click();
  }

  const navItems = [
    { id: "plan", label: "Plan", action: onOpenPlan },
    { id: "trips", label: "Trips", action: onOpenTrips },
    { id: "share", label: "Share", action: onOpenShare },
  ];

  const showDropdown = open || closing;
  const triggerLabel = isSignedIn ? `Profile menu for ${displayName}` : "Open menu";

  return (
    <div className="profile-card-menu">
      {isSignedIn && (
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="profile-card-photo-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={handlePhotoChange}
        />
      )}
      <div className="profile-card-trigger-wrap" ref={triggerRef}>
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
            tierRing={tierRing}
            className="profile-card-trigger-avatar"
            heroPalette={heroPalette}
          />
        </button>
        {isSignedIn && (
          <button
            type="button"
            className="profile-card-avatar-edit"
            disabled={uploadingPhoto}
            onClick={openPhotoPicker}
            aria-label="Change profile photo"
            title="Change profile photo"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className={`profile-card-dropdown${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
          role="dialog"
          aria-label="Navigation menu"
        >
          <div className="profile-card-dropdown-glow" aria-hidden="true" />

          <div className="profile-card-identity profile-card-identity--static">
            <div className="profile-card-identity-avatar-wrap">
              <UserAvatar
                user={user}
                profile={profile}
                size={72}
                tierRing={tierRing}
                className="profile-card-dropdown-avatar profile-card-dropdown-avatar--large"
                heroPalette={heroPalette}
              />
              {isSignedIn && (
                <button
                  type="button"
                  className="profile-card-avatar-edit profile-card-avatar-edit--large"
                  disabled={uploadingPhoto}
                  onClick={openPhotoPicker}
                  aria-label="Change profile photo"
                  title="Change profile photo"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path
                      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              )}
            </div>
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
