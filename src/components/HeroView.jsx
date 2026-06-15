import { lazy, Suspense, useEffect, useMemo } from "react";
import HeroExploreRange from "./HeroExploreRange.jsx";

const HeroExploreMap = lazy(() => import("./HeroExploreMap.jsx"));
import { lockHeroSurfaceTheme, syncSkyCycle, unlockHeroSurfaceTheme } from "../lib/surfaceTheme.js";
import { Autocomplete } from "@react-google-maps/api";
import HeroMountainScene from "./HeroMountainScene.jsx";
import HeroSkyTestDial from "./HeroSkyTestDial.jsx";
import HeroFoundingSlots from "./HeroFoundingSlots.jsx";
import AppNavBar from "./AppNavBar.jsx";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import useHeroSkyHour from "../hooks/useHeroSkyHour.js";
import { getHeroSurfaceCssVars } from "../lib/palette.js";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { getHeroSurfaceTheme, getHeroUiThemeFromHour, getSkyPhaseFromHour } from "../lib/skyTime.js";

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
  user,
  onSwap,
  onHeroOriginAcLoad,
  onHeroDestAcLoad,
  onHeroOriginPlaceChanged,
  onHeroDestPlaceChanged,
  onHeroOriginChange,
  onHeroDestChange,
  onLaunch,
  onGoHome,
  activeNav = null,
  appMode = "plan",
  onAppModeChange,
  onOpenPlan,
  onOpenTrips,
  onOpenShare,
  onOpenProfile,
  onRefreshCredits,
  onUploadAvatar,
  onGetStarted,
  onSignIn,
  onSignOut,
  userProfile,
  creditStatus = null,
  planDraft = null,
  onResumeDraft,
  onDismissDraft,
  heroExploreEnabled = false,
  heroExploreDriveSeconds = 7200,
  heroExploreLoading = false,
  heroExploreError = null,
  heroExplorePolygon = [],
  heroExploreCenter = null,
  heroTheme: heroThemeProp,
  onHeroExploreToggle,
  onHeroExploreDriveTimeChange,
  onHeroExploreMapClick,
  onHeroExplorePlaceSelect,
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
  const heroShellTheme = useMemo(() => getHeroSurfaceTheme(skyHour), [skyHour]);
  const heroSurfaceTheme = useMemo(() => getHeroUiThemeFromHour(skyHour), [skyHour]);
  const heroTheme = heroShellTheme;
  const heroSurfaceStyle = getHeroSurfaceCssVars(heroShellTheme);

  useEffect(() => {
    lockHeroSurfaceTheme(heroSurfaceTheme, { skyPhase, hour: skyHour });
    return () => {
      unlockHeroSurfaceTheme();
      const bodyTheme = document.body.classList.contains("theme-day")
        ? "day"
        : document.body.classList.contains("theme-twilight")
          ? "twilight"
          : "night";
      syncSkyCycle({ theme: bodyTheme });
    };
  }, [heroSurfaceTheme, skyPhase, skyHour]);

  const handleLaunchKey = (e) => {
    if (e.key === "Enter" && !launchDisabled) onLaunch();
  };

  return (
    <>
      <AppNavBar
        variant="hero"
        theme={heroTheme}
        onGoHome={onGoHome}
        user={user}
        userProfile={userProfile}
        creditStatus={creditStatus}
        activeNav={activeNav}
        appMode={appMode}
        onAppModeChange={onAppModeChange}
        onOpenPlan={onOpenPlan}
        onOpenTrips={onOpenTrips}
        onOpenShare={onOpenShare}
        onOpenProfile={onOpenProfile}
        onRefreshCredits={onRefreshCredits}
        onUploadAvatar={onUploadAvatar}
        onGetStarted={onGetStarted}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />

      <div
        className={`hero ${heroTheme}`}
        data-surface-theme={heroSurfaceTheme}
        style={heroSurfaceStyle}
      >
        <HeroMountainScene phase={skyPhase} hour={skyHour} />
        {heroExploreEnabled && heroExploreCenter && heroExplorePolygon.length >= 3 && (
          <Suspense fallback={null}>
            <HeroExploreMap
              isLoaded={isLoaded}
              center={heroExploreCenter}
              polygon={heroExplorePolygon}
              theme={heroTheme}
              onMapClick={onHeroExploreMapClick}
              onPlaceSelect={onHeroExplorePlaceSelect}
            />
          </Suspense>
        )}
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
                  Continue
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
            <div className="hero-search-main">
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
              <HeroFoundingSlots />
              <HeroExploreRange
                enabled={heroExploreEnabled}
                driveTimeSeconds={heroExploreDriveSeconds}
                loading={heroExploreLoading}
                error={heroExploreError}
                onToggle={onHeroExploreToggle}
                onDriveTimeChange={onHeroExploreDriveTimeChange}
              />
            </div>
            <button
              type="button"
              className="hero-go-btn"
              onClick={() => { triggerPrimaryHaptic(); onLaunch?.(); }}
              disabled={launchDisabled}
            >
              {heroLaunching ? <RouteDrawingLoader theme={heroTheme} variant="button" /> : "Plan my trip →"}
            </button>
          </div>

        </div>

        <footer className="hero-footer">
          <nav className="hero-footer-nav" aria-label="Legal and pricing">
            <a href="/pricing">Plans & pricing</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </nav>
        </footer>

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