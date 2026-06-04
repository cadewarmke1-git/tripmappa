import NavLogo from "./NavLogo.jsx";
import HamburgerMenuButton from "./HamburgerMenuButton.jsx";
import AccountSidebarTrigger from "./AccountSidebarTrigger.jsx";
import { getHeroSurfaceCssVars } from "../lib/palette.js";

export default function AppNavBar({
  onGoHome,
  appSidebarOpen = false,
  onToggleAppSidebar,
  user,
  userProfile,
  creditStatus = null,
  onGetStarted,
  onSignIn,
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
          {!user && (
            <>
              <button type="button" className="nav-btn nav-btn-signup nav-auth-cta" onClick={onGetStarted}>
                Get Started
              </button>
              <button type="button" className="nav-btn nav-btn-ghost nav-auth-cta" onClick={onSignIn}>
                Sign In
              </button>
            </>
          )}
          <HamburgerMenuButton isOpen={appSidebarOpen} onClick={onToggleAppSidebar} />
          {user && (
            <AccountSidebarTrigger
              user={user}
              profile={userProfile}
              creditStatus={creditStatus}
              isOpen={appSidebarOpen}
              onOpen={onToggleAppSidebar}
              heroTheme={isHero ? theme : undefined}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
