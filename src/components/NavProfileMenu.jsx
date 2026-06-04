import { useCallback, useEffect, useRef, useState } from "react";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";
import {
  getTierLabel,
  getTierCssClass,
  getAvatarTierBadge,
  normalizeTier,
  TIERS,
} from "../lib/tiers.js";

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
  onSignOut,
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);
  const photoInputRef = useRef(null);

  const displayName = getDisplayName(user, profile);
  const heroPalette = heroTheme ? HERO_SURFACE_PALETTE[heroTheme] : null;
  const tierBadge = getAvatarTierBadge(creditStatus?.tier || profile?.tier);

  const isAdmin = Boolean(creditStatus?.isAdmin);
  const tierKey = isAdmin ? TIERS.TRAILBLAZER : normalizeTier(creditStatus?.tier);
  const tierLabel = getTierLabel(tierKey).toUpperCase();
  const tierClass = getTierCssClass(isAdmin ? TIERS.TRAILBLAZER : (creditStatus?.tier || profile?.tier));

  const showCreditsLine = !isAdmin;
  const creditsLine = creditStatus?.unlimited
    ? "Unlimited Trip Generations"
    : creditStatus?.tier === "guest"
      ? `${creditStatus.remaining ?? 1} Trip Generation remaining`
      : creditStatus != null
        ? `${creditStatus.remaining ?? 0} of ${creditStatus.limit ?? 3} Trip Generations remaining`
        : "Loading Trip Generations…";

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
    action?.();
    closeMenu();
  }, [closeMenu]);

  useEffect(() => {
    if (!open) return undefined;
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
          aria-label="Account menu"
        >
          <div className="profile-card-dropdown-glow" aria-hidden="true" />

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

          <button
            type="button"
            className="profile-card-identity"
            onClick={() => run(onOpenProfile)}
          >
            <UserAvatar
              user={user}
              profile={profile}
              size={64}
              showRing
              tierBadge={tierBadge}
              className="profile-card-dropdown-avatar"
              heroPalette={heroPalette}
            />
            <div className="profile-card-name">{displayName}</div>
            <div className="profile-card-email">{user?.email || ""}</div>
          </button>

          <div className="profile-card-meta">
            <span className={`profile-card-tier profile-card-tier--${tierClass}`}>
              {tierLabel}
            </span>
            {showCreditsLine && (
              <p className="profile-card-credits">{creditsLine}</p>
            )}
          </div>

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

          <button
            type="button"
            className="profile-card-signout"
            onClick={() => run(onSignOut)}
          >
            Sign Out
          </button>

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
