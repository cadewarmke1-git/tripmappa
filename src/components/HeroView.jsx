import { Autocomplete } from "@react-google-maps/api";
import ThemeToggle from "./ThemeToggle.jsx";

export default function HeroView({
  theme,
  isLoaded,
  heroOrigin,
  heroDest,
  heroOriginRef,
  heroDestRef,
  onThemeToggle,
  onLogin,
  onSignup,
  onSearchHover,
  onSwap,
  onHeroOriginPlaceChanged,
  onHeroDestPlaceChanged,
  onHeroOriginChange,
  onHeroDestChange,
  onLaunch,
  onShowEmailModal,
}) {
  return (
    <>
      <nav className="nav transparent">
        <div className="nav-logo">Trip<span>Mappa</span></div>
        <div className="nav-right">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button type="button" className="nav-btn nav-btn-ghost" onClick={onLogin}>Log in</button>
          <button type="button" className="nav-btn nav-btn-signup" onClick={onSignup}>Sign up</button>
        </div>
      </nav>

      <div className={`hero ${theme}`}>
        <div
          className="hero-gradient-bg"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            background: "linear-gradient(150deg, #0a0a12 0%, #141824 45%, #1a2030 100%)",
          }}
        />

        <div className="hero-content">
          <h1 className="hero-title">
            Travel<br/>
            <span className="highlight">Reimagined.</span>
          </h1>
          <p className="hero-sub">Your next trip, planned in seconds.</p>

          <div
            className="hero-search"
            onMouseEnter={() => onSearchHover(true)}
            onMouseLeave={() => onSearchHover(false)}
          >
            <div
              className="hero-search-fields"
              style={{ position: "relative", display: "flex" }}
            >
              <div className="hero-input-wrap">
                <div className="hero-input-label">From</div>
                {isLoaded ? (
                  <Autocomplete onPlaceChanged={onHeroOriginPlaceChanged} options={{ types: ["geocode", "establishment"] }}>
                    <input ref={heroOriginRef} className="hero-input" placeholder="Dallas, TX" defaultValue={heroOrigin} onKeyDown={e => e.key === "Enter" && onLaunch()}/>
                  </Autocomplete>
                ) : (
                  <input className="hero-input" placeholder="Dallas, TX" value={heroOrigin} onChange={e => onHeroOriginChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onLaunch()}/>
                )}
              </div>
              <button
                type="button"
                className="hero-swap-btn"
                onClick={onSwap}
                aria-label="Swap origin and destination"
              >
                <svg className="hero-swap-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 2.5v11M5.5 5l2.5-2.5L10.5 5M5.5 11l2.5 2.5L10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="hero-input-wrap">
                <div className="hero-input-label">To</div>
                {isLoaded ? (
                  <Autocomplete onPlaceChanged={onHeroDestPlaceChanged} options={{ types: ["geocode", "establishment"] }}>
                    <input ref={heroDestRef} className="hero-input" placeholder="Los Angeles, CA" defaultValue={heroDest} onKeyDown={e => e.key === "Enter" && onLaunch()}/>
                  </Autocomplete>
                ) : (
                  <input className="hero-input" placeholder="Los Angeles, CA" value={heroDest} onChange={e => onHeroDestChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onLaunch()}/>
                )}
              </div>
            </div>
            <button type="button" className="hero-go-btn" onClick={onLaunch}>Plan my trip →</button>
          </div>

          <div className="hero-auth">
            <div className="hero-auth-label">Sign up with</div>
            <div className="hero-auth-btns">
              <button type="button" className="hero-auth-btn" onClick={onSignup}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </button>
              <button type="button" className="hero-auth-btn" onClick={onSignup}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </button>
              <button type="button" className="hero-auth-btn" onClick={onSignup}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Apple
              </button>
            </div>
            <div className="hero-auth-or"><span>or</span></div>
            <div className="hero-email-form">
              <button type="button" className="hero-email-btn" onClick={onShowEmailModal}>
                Continue with email
              </button>
            </div>
          </div>
        </div>

        <div className="scroll-indicator">
          <div className="scroll-arrow"/>
        </div>
      </div>
    </>
  );
}
