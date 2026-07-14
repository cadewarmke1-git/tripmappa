import NavLogo from "./NavLogo.jsx";
import NavProfileMenu from "./NavProfileMenu.jsx";
import { getHeroSurfaceCssVars } from "../lib/palette.js";

export default function AppNavBar({
  onGoHome,
  user,
  userProfile,
  creditStatus = null,
  activeNav = null,
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
  liveSharingActive = false,
  variant = "app",
  theme = "night",
}) {
  const isHero = variant === "hero";

  return (
    <nav
      className={`app-nav-bar nav app-nav-bar--${theme}${isHero ? " transparent" : " nav-app app-nav-with-logo"}`}
      data-surface-theme={isHero ? theme : undefined}
      style={isHero ? getHeroSurfaceCssVars(theme) : undefined}
    >
      <div className="app-nav-bar-left">
        <NavLogo onClick={onGoHome} theme={isHero ? theme : undefined} />
      </div>
      <div className="app-nav-bar-right">
        {liveSharingActive && (
          <span className="nav-live-badge" title="Live location sharing active">
            <span className="nav-live-badge-dot" aria-hidden="true" />
            LIVE
          </span>
        )}
        <div className="app-nav-bar-actions">
          <NavProfileMenu
            user={user}
            profile={userProfile}
            creditStatus={creditStatus}
            activeNav={activeNav}
            heroTheme={isHero ? theme : undefined}
            onOpenPlan={onOpenPlan}
            onOpenTrips={onOpenTrips}
            onOpenShare={onOpenShare}
            onOpenProfile={onOpenProfile}
            onOpenSettings={onOpenSettings}
            onRefreshCredits={onRefreshCredits}
            onUploadAvatar={onUploadAvatar}
            onGetStarted={onGetStarted}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </nav>
  );
}
