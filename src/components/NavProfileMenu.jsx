import { useCallback, useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";
import { getTierCssClass } from "../lib/tiers.js";
import { useDialogA11y } from "../hooks/useDialogA11y.js";

const HELP_URL = "https://tripmappa.com/help";

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
  onOpenSettings,
  onRefreshCredits,
  onUploadAvatar,
  onGetStarted,
  onSignIn,
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [avatarPulse, setAvatarPulse] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
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
    setSupportOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      setClosing(false);
    }, 220);
  }, [open, closing]);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setClosing(false);
    setSupportOpen(false);
    setOpen(true);
  }, []);

  const pulseAvatar = useCallback(() => {
    setAvatarPulse(true);
    window.setTimeout(() => setAvatarPulse(false), 300);
  }, []);

  const handleTriggerClick = useCallback(() => {
    pulseAvatar();
    if (open) closeMenu();
    else openMenu();
  }, [open, closeMenu, openMenu, pulseAvatar]);

  const showDropdown = open || closing;
  const dialogRef = useDialogA11y(showDropdown, closeMenu, "nav-profile-menu-title", { modal: false });
  const [menuPos, setMenuPos] = useState({ top: 0, right: 16 });

  const run = useCallback((action) => {
    // Invoke first — closing the native menu dialog synchronously can drop a
    // same-tick setState that opens the auth modal if close runs first.
    action?.();
    closeMenu();
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return undefined;
    const updatePos = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = 280;
      const right = Math.max(12, window.innerWidth - rect.right);
      const top = Math.min(rect.bottom + 10, Math.max(12, window.innerHeight - 480));
      setMenuPos({
        top: Math.max(12, top),
        right: Math.min(right, window.innerWidth - width - 12),
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

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
      const planFlow = document.querySelector(".float-card--plan-flow:not(.hidden)");
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
      if (dialogRef.current?.contains(target)) {
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

  const openHelp = () => { window.open(HELP_URL, "_blank", "noopener,noreferrer"); };

  const primaryItems = isSignedIn
    ? [
        { id: "trips", label: "My trips", action: onOpenTrips },
        { id: "plan", label: "Plan a new trip", action: onOpenPlan },
      ]
    : [
        { id: "signin", label: "Sign in", action: onSignIn },
        { id: "signup", label: "Create account", action: onGetStarted },
      ];

  const accountItems = isSignedIn
    ? [
        { id: "profile", label: "Profile", action: onOpenProfile },
        { id: "settings", label: "Settings", action: onOpenSettings },
      ]
    : [];

  const supportItems = [
    { id: "help", label: "Help", action: openHelp },
    { id: "privacy", label: "Privacy Policy", href: "/privacy" },
    { id: "terms", label: "Terms of Service", href: "/terms" },
  ];

  const triggerLabel = isSignedIn ? `Profile menu for ${displayName}` : "Open menu";

  function renderNavGroup(items, { keyPrefix = "", startIndex = 0 } = {}) {
    return items.map((item, index) => {
      const className = `profile-card-nav-link profile-card-stagger-item${activeNav === item.id ? " is-active" : ""}`;
      const style = { "--stagger-index": startIndex + index };
      if (item.href) {
        return (
          <a
            key={`${keyPrefix}${item.id}`}
            href={item.href}
            className={className}
            style={style}
            onClick={closeMenu}
          >
            {item.label}
          </a>
        );
      }
      return (
        <button
          key={`${keyPrefix}${item.id}`}
          type="button"
          className={className}
          style={style}
          onClick={() => run(item.action)}
        >
          {item.label}
        </button>
      );
    });
  }

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
          onClick={handleTriggerClick}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={triggerLabel}
        >
          <UserAvatar
            user={user}
            profile={profile}
            size="md"
            tierRing={tierRing}
            className={`profile-card-trigger-avatar${avatarPulse ? " is-click-pulse" : ""}`}
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
          ref={dialogRef}
          role="dialog"
          className={`profile-card-dropdown${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
          aria-labelledby="nav-profile-menu-title"
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, left: "auto", bottom: "auto" }}
        >
          <h2 id="nav-profile-menu-title" className="map-info-card-sr-title">Account menu</h2>

          <div className="profile-card-identity profile-card-identity--static">
            <div className="profile-card-identity-avatar-wrap">
              <UserAvatar
                user={user}
                profile={profile}
                size={56}
                tierRing={tierRing}
                className="profile-card-dropdown-avatar profile-card-dropdown-avatar--large"
                heroPalette={heroPalette}
              />
            </div>
            <div className="profile-card-name">{displayName}</div>
            {isSignedIn ? (
              <div className="profile-card-email">{user?.email || ""}</div>
            ) : (
              <div className="profile-card-email profile-card-guest-tag">Sign in to save trips & sync plans</div>
            )}
          </div>

          <div className="profile-card-menu-body">
            <nav className="profile-card-nav profile-card-nav-group" aria-label="Primary">
              {renderNavGroup(primaryItems, { startIndex: 0 })}
            </nav>

            {accountItems.length > 0 && (
              <>
                <hr className="profile-card-dropdown-divider" />
                <nav className="profile-card-nav profile-card-nav-group" aria-label="Account">
                  {renderNavGroup(accountItems, { startIndex: primaryItems.length })}
                </nav>
              </>
            )}

            <hr className="profile-card-dropdown-divider" />

            <div className="profile-card-support">
              <button
                type="button"
                className="profile-card-support-toggle"
                aria-expanded={supportOpen}
                onClick={() => setSupportOpen(v => !v)}
              >
                Support & legal
                <span className={`profile-card-support-chevron${supportOpen ? " is-open" : ""}`} aria-hidden="true">
                  ▾
                </span>
              </button>
              {supportOpen && (
                <nav className="profile-card-nav profile-card-nav-group profile-card-nav-group--support" aria-label="Support and legal">
                  {renderNavGroup(supportItems, {
                    keyPrefix: "support-",
                    startIndex: primaryItems.length + accountItems.length,
                  })}
                </nav>
              )}
            </div>

            {isSignedIn && (
              <>
                <hr className="profile-card-dropdown-divider" />
                <button
                  type="button"
                  className="profile-card-signout profile-card-stagger-item"
                  style={{ "--stagger-index": primaryItems.length + accountItems.length + 1 }}
                  onClick={() => void handleSignOutClick()}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
