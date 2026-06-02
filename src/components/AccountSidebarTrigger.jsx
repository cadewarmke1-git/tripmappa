import UserAvatar from "./UserAvatar.jsx";
import { getDisplayName } from "../lib/avatarUtils.js";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";
import { getAvatarTierBadge } from "../lib/tiers.js";

export default function AccountSidebarTrigger({ user, profile, creditStatus, isOpen, onOpen, heroTheme }) {
  const displayName = getDisplayName(user, profile);
  const heroPalette = heroTheme ? HERO_SURFACE_PALETTE[heroTheme] : null;
  const tierBadge = getAvatarTierBadge(creditStatus?.tier || profile?.tier);

  return (
    <button
      type="button"
      className={`profile-card-trigger${isOpen ? " is-active" : ""}`}
      onClick={onOpen}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-label={`Open account menu for ${displayName}`}
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
  );
}
