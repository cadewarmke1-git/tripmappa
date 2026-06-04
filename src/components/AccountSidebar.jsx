import { useEffect } from "react";
import { createPortal } from "react-dom";
import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import {
  getTierLabel,
  hasUnlimitedTripGenerations,
  isFounderTier,
  normalizeTier,
  getAvatarTierBadge,
  getTierCssClass,
  TIERS,
} from "../lib/tiers.js";
import AccountSidebarReferral from "./AccountSidebarReferral.jsx";

export default function AccountSidebar({
  open,
  closing,
  blockedByOtherSidebar = false,
  onClose,
  user,
  profile,
  creditStatus,
  onRefreshCredits,
  onOpenProfile,
  onOpenSettings,
  onOpenPreferences,
  onManageSubscription,
  onSignOut,
  onReferralCopied,
  onReferralCopyError,
}) {
  const displayName = getDisplayName(user, profile);
  const tierKey = normalizeTier(creditStatus?.tier);
  const tierLabel = getTierLabel(tierKey).toUpperCase();
  const tierClass = getTierCssClass(creditStatus?.tier || profile?.tier);
  const tierBadge = getAvatarTierBadge(creditStatus?.tier || profile?.tier);
  const showFounderTag = isFounderTier(creditStatus?.tier) || creditStatus?.isFounder;
  const showManageSubscription =
    !showFounderTag
    && (tierKey === TIERS.VOYAGER || tierKey === TIERS.TRAILBLAZER);

  const showCreditsLine = !creditStatus?.isAdmin;
  const creditsLine = creditStatus?.unlimited
    ? "Unlimited Trip Generations"
    : creditStatus?.tier === "guest"
      ? `${creditStatus.remaining ?? 1} Trip Generation remaining`
      : creditStatus != null
        ? `${creditStatus.remaining ?? 0} of ${creditStatus.limit ?? 3} Trip Generations remaining`
        : "Loading Trip Generations…";

  const visible = (open || closing) && !blockedByOtherSidebar;

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

  function handleAction(action) {
    action?.();
  }

  return createPortal(
    <>
      <button
        type="button"
        className={`app-sidebar-overlay app-sidebar-overlay-right${open && !closing ? " is-visible" : ""}${closing ? " is-closing" : ""}`}
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
            className="app-sidebar-close"
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
          onClick={() => handleAction(onOpenProfile)}
        >
          <UserAvatar
            user={user}
            profile={profile}
            size={64}
            showRing
            tierBadge={tierBadge}
            className="account-sidebar-avatar"
          />
          <div className="account-sidebar-name">{displayName}</div>
          <div className="account-sidebar-email">{user?.email || ""}</div>
          {showFounderTag && (
            <p className="account-sidebar-founder-tag">Founder Member — Founding 1,000</p>
          )}
        </button>

        <div className="account-sidebar-meta">
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

        {showManageSubscription && (
          <button
            type="button"
            className="account-sidebar-nav-item account-sidebar-manage-subscription"
            onClick={() => handleAction(onManageSubscription)}
          >
            Manage Subscription
          </button>
        )}

        {onOpenPreferences && (
          <button
            type="button"
            className="account-sidebar-nav-item"
            onClick={() => handleAction(onOpenPreferences)}
          >
            Trip preferences
          </button>
        )}

        <button
          type="button"
          className="account-sidebar-nav-item account-sidebar-settings-btn"
          onClick={() => handleAction(onOpenSettings)}
        >
          Profile Settings
        </button>

        <button
          type="button"
          className="profile-card-signout account-sidebar-signout"
          onClick={() => handleAction(onSignOut)}
        >
          Sign Out
        </button>
      </aside>
    </>,
    document.body,
  );
}
