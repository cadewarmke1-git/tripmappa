import RouteFooter from "./RouteFooter.jsx";
import HeroExploreRange from "./HeroExploreRange.jsx";

/** Pinned bottom of plan panel — origin, destination, and timing fields. */
export default function PlanPanelDock({
  isLoaded,
  origin,
  dest,
  answers,
  timingMode,
  arriveByDate,
  originRef,
  destRef,
  onSwap,
  onFetchDirections,
  onSetOrigin,
  onSetDest,
  onSetTimingMode,
  onSetArriveByDate,
  exploreRangeEnabled = false,
  exploreRangeDriveSeconds = 7200,
  exploreHasRoute = false,
  exploreCorridorStops = [],
  exploreStatusMessage = null,
  onExploreRangeToggle,
  onExploreRangeDriveTimeChange,
}) {
  return (
    <div className="plan-panel-dock">
      <RouteFooter
        isLoaded={isLoaded}
        origin={origin}
        dest={dest}
        answers={answers}
        timingMode={timingMode}
        arriveByDate={arriveByDate}
        originRef={originRef}
        destRef={destRef}
        onSwap={onSwap}
        onFetchDirections={onFetchDirections}
        onSetOrigin={onSetOrigin}
        onSetDest={onSetDest}
        onSetTimingMode={onSetTimingMode}
        onSetArriveByDate={onSetArriveByDate}
      />
      {origin?.trim() && (
        <HeroExploreRange
          enabled={exploreRangeEnabled}
          driveTimeSeconds={exploreRangeDriveSeconds}
          hasRoute={exploreHasRoute}
          corridorStops={exploreCorridorStops}
          statusMessage={exploreStatusMessage}
          onToggle={onExploreRangeToggle}
          onDriveTimeChange={onExploreRangeDriveTimeChange}
        />
      )}
    </div>
  );
}
