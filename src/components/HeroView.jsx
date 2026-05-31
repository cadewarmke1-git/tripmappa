import { useMemo } from "react";
import { Autocomplete } from "@react-google-maps/api";
import HeroMountainScene from "./HeroMountainScene.jsx";
import HeroSkyTestDial from "./HeroSkyTestDial.jsx";
import AppNavBar from "./AppNavBar.jsx";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import useHeroSkyHour from "../hooks/useHeroSkyHour.js";
import { getHeroSurfaceCssVars } from "../lib/palette.js";
import { getHeroSurfaceTheme, getSkyPhaseFromHour } from "../lib/skyTime.js";

export default function HeroView({
  isLoaded,
  heroOrigin,
  heroDest,
  heroOriginError,
  heroDestError,
  heroLaunching,
  launchDisabled,
  heroOriginRef,
  heroDestRef,
  onLogin,
  onSignup,
  onGoogle,
  onFacebook,
  onApple,
  user,
  onSwap,
  onHeroOriginAcLoad,
  onHeroDestAcLoad,
  onHeroOriginPlaceChanged,
  onHeroDestPlaceChanged,
  onHeroOriginChange,
  onHeroDestChange,
  onLaunch,
  onShowEmailModal,
  onShowPhoneModal,
  onGoHome,
  navSidebarOpen = false,
  onToggleNavSidebar,
  accountSidebarOpen = false,
  onToggleAccountSidebar,
  userProfile,
  planDraft = null,
  onResumeDraft,
  onDismissDraft,
}) {
  const {
    skyHour,
    liveHour,
    skyTestEnabled,
    isDialOverridden,
    isUrlLocked,
    setSkyHourOverride,
    resetToLive,
  } = useHeroSkyHour();

  const skyPhase = useMemo(() => getSkyPhaseFromHour(skyHour), [skyHour]);
  const heroTheme = getHeroSurfaceTheme(skyHour);
  const heroSurfaceStyle = getHeroSurfaceCssVars(heroTheme);

  const handleLaunchKey = (e) => {
    if (e.key === "Enter" && !launchDisabled) onLaunch();
  };

  return (
    <>
      <AppNavBar
        variant="hero"
        theme={heroTheme}
        onGoHome={onGoHome}
        navSidebarOpen={navSidebarOpen}
        onToggleNavSidebar={onToggleNavSidebar}
        user={user}
        userProfile={userProfile}
        accountSidebarOpen={accountSidebarOpen}
        onToggleAccountSidebar={onToggleAccountSidebar}
        onLogin={onLogin}
        onSignup={onSignup}
      />

      <div
        className={`hero ${heroTheme}`}
        data-surface-theme={heroTheme}
        style={heroSurfaceStyle}
      >
        <HeroMountainScene phase={skyPhase} hour={skyHour} />
        <div className="hero-overlay" />
        <div className="hero-palette-vignette" aria-hidden="true" />
        <div className="hero-palette-ridge" aria-hidden="true" />

        <div className="hero-content">
          <h1 className="hero-title">
            <span className="hero-title-line">Travel</span>
            <span className="hero-title-accent">Reimagined.</span>
          </h1>
          <p className="hero-sub">Your next trip, planned in seconds.</p>

          {planDraft?.origin && planDraft?.dest && (
            <div className="hero-draft-resume">
              <div className="hero-draft-resume-body">
                <p className="hero-draft-resume-text">
                  Continue planning{" "}
                  <strong className="hero-draft-route-name">{planDraft.origin.split(",")[0]}</strong> to{" "}
                  <strong className="hero-draft-route-name">{planDraft.dest.split(",")[0]}</strong>
                </p>
                <button type="button" className="hero-draft-resume-btn" onClick={onResumeDraft}>
                  Resume planning
                </button>
              </div>
              <button
                type="button"
                className="hero-draft-resume-dismiss"
                onClick={onDismissDraft}
                aria-label="Dismiss saved trip"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <div className="hero-search">
            <div className="hero-route-bar">
              <div className="hero-route-grid">
                <div className="hero-route-cell hero-route-from">
                  <div className="hero-input-label">From</div>
                  <div className="hero-input-box">
                    {isLoaded ? (
                      <Autocomplete onLoad={onHeroOriginAcLoad} onPlaceChanged={onHeroOriginPlaceChanged} options={{ types: ["geocode", "establishment"] }}>
                        <input ref={heroOriginRef} className="hero-input" placeholder="Dallas, TX" defaultValue={heroOrigin} onChange={e => onHeroOriginChange(e.target.value)} onKeyDown={handleLaunchKey}/>
                      </Autocomplete>
                    ) : (
                      <input className="hero-input" placeholder="Dallas, TX" value={heroOrigin} onChange={e => onHeroOriginChange(e.target.value)} onKeyDown={handleLaunchKey}/>
                    )}
                  </div>
                  {heroOriginError && <div className="hero-input-error">{heroOriginError}</div>}
                </div>

                <div className="hero-route-swap-col" aria-hidden="false">
                  <button
                    type="button"
                    className="hero-swap-btn"
                    onClick={onSwap}
                    aria-label="Swap destination and origin"
                  >
                    <svg className="hero-swap-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 2.5v11M5.5 5l2.5-2.5L10.5 5M5.5 11l2.5 2.5L10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                <div className="hero-route-cell hero-route-to">
                  <div className="hero-input-label">To</div>
                  <div className="hero-input-box">
                    {isLoaded ? (
                      <Autocomplete onLoad={onHeroDestAcLoad} onPlaceChanged={onHeroDestPlaceChanged} options={{ types: ["geocode", "establishment"] }}>
                        <input ref={heroDestRef} className="hero-input" placeholder="Los Angeles, CA" defaultValue={heroDest} onChange={e => onHeroDestChange(e.target.value)} onKeyDown={handleLaunchKey}/>
                      </Autocomplete>
                    ) : (
                      <input className="hero-input" placeholder="Los Angeles, CA" value={heroDest} onChange={e => onHeroDestChange(e.target.value)} onKeyDown={handleLaunchKey}/>
                    )}
                  </div>
                  {heroDestError && <div className="hero-input-error">{heroDestError}</div>}
                </div>
              </div>
            </div>
            <button type="button" className="hero-go-btn" onClick={onLaunch} disabled={launchDisabled}>
              {heroLaunching ? <RouteDrawingLoader theme={heroTheme} variant="button" /> : "Plan my trip →"}
            </button>
          </div>

          <div className="hero-auth">
            <div className="hero-auth-label">Sign up with</div>
            <div className="hero-auth-btns">
              <button type="button" className="hero-auth-btn" onClick={onGoogle}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button type="button" className="hero-auth-btn" onClick={onFacebook}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </button>
              <button type="button" className="hero-auth-btn" onClick={onApple}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Apple
              </button>
            </div>
            <div className="hero-auth-or"><span>or</span></div>
            <div className="hero-email-form">
              <button type="button" className="hero-email-btn" onClick={onShowEmailModal}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Continue with email
              </button>
              <button type="button" className="hero-phone-btn" onClick={onShowPhoneModal}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
                </svg>
                Continue with phone
              </button>
            </div>
          </div>
        </div>

        <div className="scroll-indicator">
          <div className="scroll-arrow"/>
        </div>

        {skyTestEnabled && (
          <HeroSkyTestDial
            hour={skyHour}
            liveHour={liveHour}
            phase={skyPhase}
            isOverridden={isDialOverridden}
            isUrlLocked={isUrlLocked}
            onHourChange={setSkyHourOverride}
            onResetLive={resetToLive}
          />
        )}
      </div>
    </>
  );
}