import { useEffect } from "react";
import { createPortal } from "react-dom";
import UserAvatar from "./UserAvatar.jsx";
import AccountSidebarReferral from "./AccountSidebarReferral.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import {
  getTierLabel,
  isFounderTier,
  normalizeTier,
  getAvatarTierBadge,
  getTierCssClass,
  TIERS,
} from "../lib/tiers.js";
import { useTheme } from "../context/ThemeContext.jsx";

export default function AppSidebar({
  open,
  closing,
  onClose,
  theme: themeProp,
  activeNav = null,
  user = null,
  profile = null,
  creditStatus = null,
  onRefreshCredits,
  onOpenPlan,
  onOpenTrips,
  onOpenShare,
  onOpenProfile,
  onOpenSettings,
  onOpenPreferences,
  onManageSubscription,
  onSignOut,
  onGetStarted,
  onSignIn,
  onReferralCopied,
  onReferralCopyError,
}) {
  const { theme: contextTheme } = useTheme();
  const theme = themeProp ?? contextTheme;
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

  const navItems = [
    { id: "plan", label: "Plan", action: onOpenPlan },
    { id: "trips", label: "Trips", action: onOpenTrips },
    { id: "share", label: "Share", action: onOpenShare },
  ];

  const isAdmin = Boolean(creditStatus?.isAdmin);
  const tierKey = isAdmin ? TIERS.TRAILBLAZER : normalizeTier(creditStatus?.tier);
  const tierLabel = getTierLabel(tierKey).toUpperCase();
  const tierClass = getTierCssClass(isAdmin ? TIERS.TRAILBLAZER : (creditStatus?.tier || profile?.tier));
  const tierBadge = getAvatarTierBadge(creditStatus?.tier || profile?.tier);
  const showFounderTag = !isAdmin && (isFounderTier(creditStatus?.tier) || creditStatus?.isFounder);
  const showManageSubscription =
    !showFounderTag
    && !isAdmin
    && (tierKey === TIERS.VOYAGER || tierKey === TIERS.TRAILBLAZER);
  const showCreditsLine = !isAdmin;
  const creditsLine = creditStatus?.unlimited
    ? "Unlimited Trip Generations"
    : creditStatus?.tier === "guest"
      ? `${creditStatus.remaining ?? 1} Trip Generation remaining`
      : creditStatus != null
        ? `${creditStatus.remaining ?? 0} of ${creditStatus.limit ?? 3} Trip Generations remaining`
        : "Loading Trip Generations…";

  const displayName = user ? getDisplayName(user, profile) : null;

  function run(action) {
    action?.();
  }

  return createPortal(
    <>
      <button
        type="button"
        className={`app-sidebar-overlay app-sidebar-overlay-right${open && !closing ? " is-visible" : ""}${closing ? " is-closing" : ""}`}
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside
        className={`app-sidebar ${theme}${open && !closing ? " is-open" : ""}${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="app-sidebar-glow" aria-hidden="true" />
        <div className="app-sidebar-header">
          <h2 className="app-sidebar-title">Menu</h2>
          <button
            type="button"
            className="app-sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="app-sidebar-nav" aria-label="Main navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              className={`app-sidebar-nav-item${activeNav === item.id ? " is-active" : ""}`}
              onClick={() => run(item.action)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {user ? (
          <>
            <button
              type="button"
              className="app-sidebar-identity"
              onClick={() => run(onOpenProfile)}
            >
              <UserAvatar
                user={user}
                profile={profile}
                size={64}
                showRing
                tierBadge={tierBadge}
                className="app-sidebar-avatar"
              />
              <div className="app-sidebar-name">{displayName}</div>
              <div className="app-sidebar-email">{user?.email || ""}</div>
              {showFounderTag && (
                <p className="app-sidebar-founder-tag">Founder Member — Founding 1,000</p>
              )}
            </button>

            <div className="app-sidebar-meta">
              <span className={`profile-card-tier profile-card-tier--${tierClass}`}>
                {tierLabel}
              </span>
              {showCreditsLine && (
                <p className="profile-card-credits">{creditsLine}</p>
              )}
            </div>

            <AccountSidebarReferral
              referralLink={creditStatus?.referralLink}
              onCopied={onReferralCopied}
              onCopyError={onReferralCopyError}
            />

            <div className="app-sidebar-actions">
              {showManageSubscription && (
                <button
                  type="button"
                  className="app-sidebar-action-btn"
                  onClick={() => run(onManageSubscription)}
                >
                  Manage Subscription
                </button>
              )}
              {onOpenPreferences && (
                <button
                  type="button"
                  className="app-sidebar-action-btn"
                  onClick={() => run(onOpenPreferences)}
                >
                  Trip preferences
                </button>
              )}
              <button
                type="button"
                className="app-sidebar-action-btn"
                onClick={() => run(onOpenSettings)}
              >
                Profile settings
              </button>
            </div>

            <button
              type="button"
              className="app-sidebar-signout"
              onClick={() => run(onSignOut)}
            >
              Sign Out
            </button>
          </>
        ) : (
          <div className="app-sidebar-guest">
            <p className="app-sidebar-guest-lead">Sign in to save trips and sync preferences across devices.</p>
            <div className="app-sidebar-guest-actions">
              {onGetStarted && (
                <button
                  type="button"
                  className="app-sidebar-action-btn app-sidebar-action-btn-primary"
                  onClick={() => { onGetStarted(); onClose?.(); }}
                >
                  Get Started
                </button>
              )}
              {onSignIn && (
                <button
                  type="button"
                  className="app-sidebar-action-btn"
                  onClick={() => { onSignIn(); onClose?.(); }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}

        <div className="app-sidebar-footer">
          <nav className="app-sidebar-legal" aria-label="Legal">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </nav>
        </div>
      </aside>
    </>,
    document.body,
  );
}
