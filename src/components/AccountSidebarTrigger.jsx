import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";

export default function AccountSidebarTrigger({ user, profile, isOpen, onOpen }) {
  const displayName = getDisplayName(user, profile);

  return (
    <button
      type="button"
      className={`profile-card-trigger${isOpen ? " is-active" : ""}`}
      onClick={onOpen}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={`Open account menu for ${displayName}`}
    >
      <UserAvatar user={user} profile={profile} size="md" showRing className="profile-card-trigger-avatar" />
    </button>
  );
}
