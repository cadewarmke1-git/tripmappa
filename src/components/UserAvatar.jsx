import { getDisplayName, getInitials } from "../lib/avatarUtils.js";

const SIZE_MAP = { sm: 32, md: 40, lg: 96, xl: 120 };

export default function UserAvatar({
  user,
  profile,
  size = "md",
  className = "",
  showRing = false,
  title,
}) {
  const px = typeof size === "number" ? size : (SIZE_MAP[size] || 40);
  const name = getDisplayName(user, profile);
  const initials = getInitials(name);
  const src = profile?.avatar_url;

  return (
    <span
      className={`user-avatar${showRing ? " user-avatar-ring" : ""}${className ? ` ${className}` : ""}`}
      style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.34)) }}
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
