import { useEffect, useMemo, useState } from "react";
import { lockHeroSurfaceTheme, syncSkyCycle, unlockHeroSurfaceTheme } from "../lib/surfaceTheme.js";
import HeroHighwayScene from "./HeroHighwayScene.jsx";
import HeroMountainScene from "./HeroMountainScene.jsx";
import HeroSkyTestDial from "./HeroSkyTestDial.jsx";
import AppNavBar from "./AppNavBar.jsx";
import GoldSpinner from "./GoldSpinner.jsx";
import useHeroSkyHour from "../hooks/useHeroSkyHour.js";
import { getHeroSurfaceCssVars } from "../lib/palette.js";
import { getGreetingFirstName } from "../lib/avatarUtils.js";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { getHeroSurfaceTheme, getHeroUiThemeFromHour, getSkyPhaseFromHour } from "../lib/skyTime.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function shortCity(value) {
  if (!value) return "";
  return value.split(",")[0].trim();
}

function isRecentTrip(trip) {
  if (!trip) return false;
  let tripDate = null;
  if (trip.createdAt) {
    const parsed = new Date(trip.createdAt);
    if (!Number.isNaN(parsed.getTime())) tripDate = parsed;
  }
  if (!tripDate && trip.date) {
    const parsed = new Date(trip.date);
    if (!Number.isNaN(parsed.getTime())) tripDate = parsed;
  }
  if (!tripDate) return false;
  return Date.now() - tripDate.getTime() < SEVEN_DAYS_MS;
}

function buildReturningGreeting({ firstName, creditStatus, recentTrip, hasSavedTrips, hasPlanDraft }) {
  const remaining = creditStatus?.remaining;
  const unlimited = creditStatus?.unlimited;

  if (!unlimited && remaining != null && remaining >= 1 && remaining <= 2) {
    return `${remaining} trip${remaining === 1 ? "" : "s"} left — make this one count`;
  }
  if (isRecentTrip(recentTrip)) {
    return `Back on the road soon, ${firstName}?`;
  }
  if (!hasSavedTrips && !hasPlanDraft) {
    return `Ready for your first route, ${firstName}?`;
  }
  return `Welcome back, ${firstName}, where to next?`;
}

export default function ReturningUserView({
  user,
  userProfile,
  creditStatus = null,
  homeAddress = "",
  planDraft = null,
  recentTrip = null,
  savedTripsCount = 0,
  liveSharingActive = false,
  loading = false,
  planLaunching = false,
  navigateLaunching = false,
  onStartPlan,
  onStartNavigate,
  onNavigateHome,
  onNavigateToDestination,
  onOpenTrips,
  onContinueTrips = null,
  onOpenShare,
  onGoHome,
  onOpenPlan,
  onOpenProfile,
  onOpenSettings,
  onRefreshCredits,
  onUploadAvatar,
  onSignOut,
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
  const [contentReady, setContentReady] = useState(false);

  const skyPhase = useMemo(() => getSkyPhaseFromHour(skyHour), [skyHour]);
  const heroShellTheme = useMemo(() => getHeroSurfaceTheme(skyHour), [skyHour]);
  const heroSurfaceTheme = useMemo(() => getHeroUiThemeFromHour(skyHour), [skyHour]);
  const heroTheme = heroShellTheme;
  const heroSurfaceStyle = getHeroSurfaceCssVars(heroShellTheme);

  // display_name → first part of full_name → email prefix (last resort)
  const firstName = getGreetingFirstName(user, userProfile) || "Traveler";
  const hasPlanDraft = Boolean(planDraft?.origin && planDraft?.dest);
  const hasContinueTrips = hasPlanDraft || savedTripsCount > 0;
  const homeLabel = shortCity(homeAddress || userProfile?.home_address) || "Home";
  const lastDestLabel = shortCity(recentTrip?.dest);
  const hasHome = Boolean((homeAddress || userProfile?.home_address || "").trim());

  const greeting = useMemo(
    () => buildReturningGreeting({
      firstName,
      creditStatus,
      recentTrip,
      hasSavedTrips: savedTripsCount > 0,
      hasPlanDraft,
    }),
    [firstName, creditStatus, recentTrip, savedTripsCount, hasPlanDraft],
  );

  const destinationChips = useMemo(() => {
    const chips = [];
    if (hasHome) {
      chips.push({
        key: "home",
        label: "Head home",
        detail: homeLabel,
        onSelect: () => onNavigateHome?.(),
      });
    }
    if (lastDestLabel && recentTrip?.dest) {
      chips.push({
        key: "last-dest",
        label: lastDestLabel,
        detail: "Last destination",
        onSelect: () => onNavigateToDestination?.(recentTrip.dest),
      });
    }
    return chips;
  }, [hasHome, homeLabel, lastDestLabel, recentTrip?.dest, onNavigateHome, onNavigateToDestination]);

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

  useEffect(() => {
    if (loading) {
      setContentReady(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setContentReady(true));
    return () => cancelAnimationFrame(frame);
  }, [loading]);

  function withHaptic(handler) {
    return () => {
      triggerPrimaryHaptic();
      handler?.();
    };
  }

  return (
    <>
      <AppNavBar
        variant="hero"
        theme={heroTheme}
        onGoHome={onGoHome}
        user={user}
        userProfile={userProfile}
        creditStatus={creditStatus}
        activeNav={null}
        onOpenPlan={onOpenPlan}
        onOpenTrips={onOpenTrips}
        onOpenShare={onOpenShare}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onRefreshCredits={onRefreshCredits}
        onUploadAvatar={onUploadAvatar}
        onGetStarted={onStartPlan}
        onSignIn={onStartPlan}
        onSignOut={onSignOut}
      />

      <div
        className={`hero returning-user-view ${heroTheme}${contentReady && !loading ? " is-ready" : ""}`}
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

        <div className="hero-content returning-user-content">
          {loading ? (
            <div className="returning-user-loading" role="status" aria-busy="true" aria-label="Loading your dashboard">
              <GoldSpinner size="lg" />
            </div>
          ) : (
            <>
              <h1 className="hero-title hero-title-line returning-user-greeting">{greeting}</h1>
              <p className="returning-user-tagline">Your trip, our mission.</p>

              <div className="returning-user-actions" role="group" aria-label="Start planning or navigating">
                <button
                  type="button"
                  className="returning-user-action returning-user-action--plan"
                  onClick={withHaptic(onStartPlan)}
                  disabled={planLaunching}
                >
                  {planLaunching ? <GoldSpinner size="button" /> : "Plan a new trip"}
                </button>

                <button
                  type="button"
                  className="returning-user-action returning-user-action--navigate"
                  onClick={withHaptic(onStartNavigate)}
                  disabled={navigateLaunching}
                >
                  {navigateLaunching ? <GoldSpinner size="button" /> : "Open navigate"}
                </button>
              </div>

              {hasContinueTrips && (
                <button
                  type="button"
                  className="returning-user-continue-trips"
                  onClick={withHaptic(onContinueTrips || onOpenTrips)}
                >
                  Continue trips →
                </button>
              )}

              {liveSharingActive && (
                <button type="button" className="returning-user-live-share" onClick={withHaptic(onOpenShare)}>
                  <span className="returning-user-live-pulse" aria-hidden="true" />
                  <span className="returning-user-live-text">Your crew is on this trip</span>
                  <span className="returning-user-live-link">Open share →</span>
                </button>
              )}

              {destinationChips.length > 0 && (
                <div className="returning-user-quick-nav">
                  <p className="returning-user-quick-nav-label">Quick navigate</p>
                  <div className="returning-user-chips">
                    {destinationChips.map(chip => (
                      <button
                        key={chip.key}
                        type="button"
                        className={`returning-user-chip${chip.key === "home" ? " returning-user-chip--home" : ""}`}
                        onClick={withHaptic(chip.onSelect)}
                        disabled={navigateLaunching}
                      >
                        <span className="returning-user-chip-label">{chip.label}</span>
                        <span className="returning-user-chip-detail">{chip.detail}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
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
