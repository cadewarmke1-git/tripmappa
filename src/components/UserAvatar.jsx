import { getDisplayName, getInitials } from "../lib/avatarUtils.js";

const SIZE_MAP = { sm: 32, md: 40, lg: 96, xl: 120 };

function TierStarBadge({ variant }) {
  return (
    <span className={`user-avatar-tier-badge user-avatar-tier-badge--${variant}`} aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 24 24" focusable="false">
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export default function UserAvatar({
  user,
  profile,
  size = "md",
  className = "",
  showRing = false,
  tierBadge = null,
  /** @deprecated use tierBadge */
  premiumBadge = false,
  title,
  heroPalette = null,
}) {
  const px = typeof size === "number" ? size : (SIZE_MAP[size] || 40);
  const name = getDisplayName(user, profile);
  const initials = getInitials(name);
  const src = profile?.avatar_url;
  const badge = tierBadge || (premiumBadge ? "trailblazer" : null);

  const heroStyle = heroPalette
    ? {
        boxShadow: heroPalette.avatarRing,
        ...(!src
          ? {
              background: heroPalette.avatarGradient,
              color: heroPalette.avatarText,
            }
          : {}),
      }
    : null;

  return (
    <span
      className={`user-avatar${badge ? " user-avatar--tier-visible" : ""}${showRing ? " user-avatar-ring" : ""}${badge ? ` user-avatar-has-tier-badge user-avatar-tier-ring--${badge}` : ""}${className ? ` ${className}` : ""}`}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(10, Math.round(px * 0.34)),
        ...heroStyle,
      }}
      title={title || name}
      aria-hidden={title ? undefined : true}
    >
      {src ? (
        <img src={src} alt="" className="user-avatar-img" />
      ) : (
        <span className="user-avatar-initials">{initials}</span>
      )}
      {badge && <TierStarBadge variant={badge} />}
    </span>
  );
}
