import NavLogo from "./NavLogo.jsx";
import HamburgerMenuButton from "./HamburgerMenuButton.jsx";
import AccountSidebarTrigger from "./AccountSidebarTrigger.jsx";

export default function AppNavBar({
  onGoHome,
  navSidebarOpen = false,
  onToggleNavSidebar,
  user,
  userProfile,
  accountSidebarOpen = false,
  onToggleAccountSidebar,
  onLogin,
  onSignup,
  liveSharingActive = false,
  variant = "app",
  theme = "night",
}) {
  const isHero = variant === "hero";

  /* Never add the page `.hero` class here — it applies full-viewport layout and blocks clicks. */
  return (
    <nav
      className={`app-nav-bar nav app-nav-bar--${theme}${isHero ? " transparent" : " nav-app app-nav-with-logo"}`}
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
          <HamburgerMenuButton isOpen={navSidebarOpen} onClick={onToggleNavSidebar} />
          {user ? (
            <AccountSidebarTrigger
              user={user}
              profile={userProfile}
              isOpen={accountSidebarOpen}
              onOpen={onToggleAccountSidebar}
              heroTheme={isHero ? theme : undefined}
            />
          ) : (
            <>
              <button type="button" className="nav-btn nav-btn-ghost nav-auth-desktop" onClick={onLogin}>Log in</button>
              {!isHero && (
                <button type="button" className="nav-btn nav-btn-signup nav-auth-desktop" onClick={onSignup}>Sign up</button>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
