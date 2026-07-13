import { useEffect, useMemo, useState } from "react";
import { lockHeroSurfaceTheme, syncSkyCycle, unlockHeroSurfaceTheme } from "../lib/surfaceTheme.js";
import HeroHighwayScene from "./HeroHighwayScene.jsx";
import HeroMountainScene from "./HeroMountainScene.jsx";
import HeroSkyTestDial from "./HeroSkyTestDial.jsx";
import HeroFoundingSlots from "./HeroFoundingSlots.jsx";
import HeroValueShowcase from "./HeroValueShowcase.jsx";
import AppNavBar from "./AppNavBar.jsx";
import GoldSpinner from "./GoldSpinner.jsx";
import useHeroSkyHour from "../hooks/useHeroSkyHour.js";
import { getHeroSurfaceCssVars } from "../lib/palette.js";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { getHeroSurfaceTheme, getHeroUiThemeFromHour, getSkyPhaseFromHour } from "../lib/skyTime.js";

export default function HeroView({
  planLaunching = false,
  launchDisabled = false,
  user,
  onStartPlan,
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
  heroTheme: heroThemeProp,
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

  const [useMountainFallback, setUseMountainFallback] = useState(false);

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
        {useMountainFallback ? (
          <HeroMountainScene phase={skyPhase} hour={skyHour} />
        ) : (
          <HeroHighwayScene onPhotoError={() => setUseMountainFallback(true)} />
        )}
        <div className="hero-overlay" />
        <div className="hero-palette-vignette" aria-hidden="true" />
        <div className="hero-palette-ridge" aria-hidden="true" />

        <div className="hero-content">
          <p className="trip-overview-hero-eyebrow">The open road awaits</p>
          <h1 className="hero-title hero-title-line">Your trip, our mission.</h1>

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

          <HeroValueShowcase />

          <button
            type="button"
            className="hero-plan-cta"
            onClick={() => { triggerPrimaryHaptic(); onStartPlan?.(); }}
            disabled={launchDisabled}
          >
            {planLaunching ? <GoldSpinner size="button" /> : "Plan your trip →"}
          </button>
        </div>

        <footer className="hero-footer">
          <HeroFoundingSlots />
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
