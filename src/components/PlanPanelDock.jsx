import RouteFooter from "./RouteFooter.jsx";

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
    </div>
  );
}
