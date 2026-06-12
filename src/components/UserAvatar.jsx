import { getDisplayName, getInitials } from "../lib/avatarUtils.js";

const SIZE_MAP = { sm: 32, md: 40, lg: 96, xl: 120 };

export default function UserAvatar({
  user,
  profile,
  size = "md",
  className = "",
  showRing = false,
  tierRing = null,
  tierBadge = null,
  /** @deprecated use tierRing */
  premiumBadge = false,
  title,
  heroPalette = null,
}) {
  const px = typeof size === "number" ? size : (SIZE_MAP[size] || 40);
  const name = getDisplayName(user, profile);
  const initials = getInitials(name);
  const src = profile?.avatar_url;
  const ring = tierRing || tierBadge || (premiumBadge ? "trailblazer" : null);

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
      className={`user-avatar${ring ? ` user-avatar-tier-ring--${ring}` : ""}${showRing && !ring ? " user-avatar-ring" : ""}${className ? ` ${className}` : ""}`}
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
    </span>
  );
}
