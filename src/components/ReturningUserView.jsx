import { useEffect, useMemo, useState } from "react";
import { lockHeroSurfaceTheme, syncSkyCycle, unlockHeroSurfaceTheme } from "../lib/surfaceTheme.js";
import HeroHighwayScene from "./HeroHighwayScene.jsx";
import HeroMountainScene from "./HeroMountainScene.jsx";
import HeroSkyTestDial from "./HeroSkyTestDial.jsx";
import AppNavBar from "./AppNavBar.jsx";
import GoldSpinner from "./GoldSpinner.jsx";
import RouteMapThumbnail from "./RouteMapThumbnail.jsx";
import useHeroSkyHour from "../hooks/useHeroSkyHour.js";
import { getHeroSurfaceCssVars } from "../lib/palette.js";
import { getDisplayName } from "../lib/avatarUtils.js";
import { getItineraryOverview } from "../lib/itineraryDays.js";
import { getEffectiveVehicle } from "../lib/vehicles.js";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { getHeroSurfaceTheme, getHeroUiThemeFromHour, getSkyPhaseFromHour } from "../lib/skyTime.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function shortCity(value) {
  if (!value) return "";
  return value.split(",")[0].trim();
}

function tripRouteLabel(trip) {
  const from = shortCity(trip?.origin);
  const to = shortCity(trip?.dest);
  if (from && to) return `${from} → ${to}`;
  return trip?.origin || trip?.dest || "Saved route";
}

function tripStopCount(trip) {
  return (trip?.stops?.length || 0) + (trip?.roadStops?.length || 0);
}

function collectStopPoints(trip) {
  const fromStops = (trip?.stops || [])
    .filter(s => s?.lat != null && s?.lng != null)
    .map(s => ({ lat: s.lat, lng: s.lng }));
  const fromRoad = (trip?.roadStops || [])
    .filter(s => s?.lat != null && s?.lng != null)
    .map(s => ({ lat: s.lat, lng: s.lng }));
  return [...fromStops, ...fromRoad];
}

function tripDayCount(trip) {
  const overview = getItineraryOverview({
    stops: trip?.stops || [],
    roadStops: trip?.roadStops || [],
    answers: trip?.answers || {},
  });
  return overview.straightThrough ? 1 : Math.max(1, overview.dayCount || 1);
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

function vehicleLabel(answers) {
  const vehicle = getEffectiveVehicle(answers || {}) || answers?.vehicle;
  if (!vehicle) return null;
  const dash = String(vehicle).indexOf("—");
  if (dash > 0) return String(vehicle).slice(0, dash).trim();
  if (vehicle === "Semi Truck (18-wheeler)") return "Semi truck";
  return vehicle;
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
  onResumeDraft,
  onDismissDraft,
  onResumeTrip,
  onPlanReturnTrip,
  onOpenTrips,
  onOpenShare,
  onGoHome,
  appMode = "plan",
  onAppModeChange,
  onOpenPlan,
  onOpenProfile,
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

  const skyPhase = useMemo(() => getSkyPhaseFromHour(skyHour), [skyHour]);
  const heroShellTheme = useMemo(() => getHeroSurfaceTheme(skyHour), [skyHour]);
  const heroSurfaceTheme = useMemo(() => getHeroUiThemeFromHour(skyHour), [skyHour]);
  const heroTheme = heroShellTheme;
  const heroSurfaceStyle = getHeroSurfaceCssVars(heroShellTheme);

  const displayName = getDisplayName(user, userProfile);
  const firstName = displayName.split(/\s+/)[0] || "Traveler";
  const hasPlanDraft = Boolean(planDraft?.origin && planDraft?.dest);
  const hasRecentTrip = Boolean(recentTrip?.origin && recentTrip?.dest);
  const showPrimaryActions = !hasPlanDraft && !hasRecentTrip;
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

  const tripMeta = useMemo(() => {
    if (!recentTrip) return null;
    const stops = tripStopCount(recentTrip);
    const days = tripDayCount(recentTrip);
    const vehicle = vehicleLabel(recentTrip.answers);
    const parts = [];
    if (vehicle) parts.push(vehicle);
    if (stops > 0) parts.push(`${stops} stop${stops === 1 ? "" : "s"}`);
    if (recentTrip.routeInfo?.distance) parts.push(recentTrip.routeInfo.distance);
    if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    return parts;
  }, [recentTrip]);

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
        appMode={appMode}
        onAppModeChange={onAppModeChange}
        onOpenPlan={onOpenPlan}
        onOpenTrips={onOpenTrips}
        onOpenShare={onOpenShare}
        onOpenProfile={onOpenProfile}
        onRefreshCredits={onRefreshCredits}
        onUploadAvatar={onUploadAvatar}
        onGetStarted={onStartPlan}
        onSignIn={onStartPlan}
        onSignOut={onSignOut}
      />

      <div
        className={`hero returning-user-view ${heroTheme}`}
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
              <p className="returning-user-eyebrow">Welcome back</p>
              <h1 className="hero-title hero-title-line returning-user-greeting">{greeting}</h1>

              {hasPlanDraft && (
                <div className="returning-user-draft">
                  <div className="returning-user-draft-body">
                    <p className="returning-user-draft-label">Continue planning</p>
                    <p className="returning-user-draft-route">
                      <strong>{shortCity(planDraft.origin)}</strong>
                      <span className="returning-user-draft-arrow" aria-hidden="true"> → </span>
                      <strong>{shortCity(planDraft.dest)}</strong>
                    </p>
                  </div>
                  <div className="returning-user-draft-actions">
                    <button type="button" className="returning-user-draft-btn" onClick={withHaptic(onResumeDraft)}>
                      Continue
                    </button>
                    {onDismissDraft && (
                      <button
                        type="button"
                        className="returning-user-draft-dismiss"
                        onClick={onDismissDraft}
                        aria-label="Dismiss saved plan"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {liveSharingActive && (
                <button type="button" className="returning-user-live-share" onClick={withHaptic(onOpenShare)}>
                  <span className="returning-user-live-pulse" aria-hidden="true" />
                  <span className="returning-user-live-text">Your crew is on this trip</span>
                  <span className="returning-user-live-link">Open share →</span>
                </button>
              )}

              {hasRecentTrip && (
                <div className="returning-user-recent">
                  <RouteMapThumbnail
                    routePoints={recentTrip.routeInfo?.routePoints}
                    stopPoints={collectStopPoints(recentTrip)}
                    className="returning-user-recent-thumb"
                  />
                  <div className="returning-user-recent-main">
                    <p className="returning-user-recent-label">Your last trip</p>
                    <p className="returning-user-recent-route">{tripRouteLabel(recentTrip)}</p>
                    {tripMeta?.length > 0 && (
                      <p className="returning-user-recent-meta">
                        {tripMeta.map((part, index) => (
                          <span key={part}>
                            {index > 0 && <span className="returning-user-recent-sep" aria-hidden="true"> · </span>}
                            {part}
                          </span>
                        ))}
                      </p>
                    )}
                    <div className="returning-user-recent-actions">
                      <button type="button" className="returning-user-resume-btn" onClick={withHaptic(() => onResumeTrip?.(recentTrip))}>
                        Resume trip
                      </button>
                      <button type="button" className="returning-user-return-btn" onClick={withHaptic(() => onPlanReturnTrip?.(recentTrip))}>
                        Plan return trip
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {savedTripsCount > 0 && (
                <button type="button" className="returning-user-all-trips" onClick={withHaptic(onOpenTrips)}>
                  See all trips →
                </button>
              )}

              {showPrimaryActions ? (
                <div className="returning-user-actions">
                  <button
                    type="button"
                    className="returning-user-action returning-user-action--plan"
                    onClick={withHaptic(onStartPlan)}
                    disabled={planLaunching}
                  >
                    <span className="returning-user-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="returning-user-action-title">Plan a trip</span>
                    <span className="returning-user-action-detail">Route, vehicle, and stops tailored to you</span>
                    {planLaunching && <GoldSpinner size="button" />}
                  </button>

                  <button
                    type="button"
                    className="returning-user-action returning-user-action--navigate"
                    onClick={withHaptic(onStartNavigate)}
                    disabled={navigateLaunching}
                  >
                    <span className="returning-user-action-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
                        <path d="M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="returning-user-action-title">Navigate</span>
                    <span className="returning-user-action-detail">Turn-by-turn from your current location</span>
                    {navigateLaunching && <GoldSpinner size="button" />}
                  </button>
                </div>
              ) : (
                <div className="returning-user-compact-actions">
                  <button
                    type="button"
                    className="returning-user-compact-btn returning-user-compact-btn--plan"
                    onClick={withHaptic(onStartPlan)}
                    disabled={planLaunching}
                  >
                    {planLaunching ? <GoldSpinner size="button" /> : "Plan a new trip"}
                  </button>
                  <button
                    type="button"
                    className="returning-user-compact-btn returning-user-compact-btn--navigate"
                    onClick={withHaptic(onStartNavigate)}
                    disabled={navigateLaunching}
                  >
                    {navigateLaunching ? <GoldSpinner size="button" /> : "Open navigate"}
                  </button>
                </div>
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
