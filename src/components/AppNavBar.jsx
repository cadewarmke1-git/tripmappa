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

  return (
    <nav
      className={`app-nav-bar nav${isHero ? ` hero ${theme} transparent` : " nav-app app-nav-with-logo"}`}
    >
      <div className="app-nav-bar-left">
        <NavLogo onClick={onGoHome} />
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
            />
          ) : isHero ? (
            <>
              <button type="button" className="nav-btn nav-btn-ghost" onClick={onLogin}>Log in</button>
              <button type="button" className="nav-btn nav-btn-signup" onClick={onSignup}>Sign up</button>
            </>
          ) : (
            <button type="button" className="nav-btn nav-btn-ghost" onClick={onLogin}>Log in</button>
          )}
        </div>
      </div>
    </nav>
  );
}
