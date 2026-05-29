import { isContinuousDrive } from "../lib/driveMode.js";
import { isScenicRoute } from "../lib/vehicles.js";

export default function PlanRouteCard({
  origin,
  dest,
  routeInfo,
  answers = {},
  routePending = false,
}) {
  const ready = Boolean(routeInfo?.distance || routeInfo?.duration);

  const chips = [
    answers.vehicle,
    answers.travelers && `${answers.travelers} traveler${answers.travelers === "1" ? "" : "s"}`,
    isScenicRoute(answers) && "Scenic",
    isContinuousDrive(answers) && "Straight through",
    answers.overnight_preference === "Stop overnight along the way" && "Overnights",
    answers.lodging && answers.lodging !== "No overnight stay" && answers.lodging,
  ].filter(Boolean);

  return (
    <div className={`plan-route-card${routePending ? " plan-route-card-pending" : ""}`}>
      <div className="plan-route-card-row">
        <div className="plan-route-card-endpoints">
          <span className="plan-route-card-city">{origin?.split(",")[0]?.trim() || "Origin"}</span>
          <span className="plan-route-card-arrow" aria-hidden="true">→</span>
          <span className="plan-route-card-city">{dest?.split(",")[0]?.trim() || "Destination"}</span>
        </div>
        <div className="plan-route-card-stats">
          {routePending || !ready ? (
            <span className="plan-route-card-loading">
              <span className="question-loading-spinner" aria-hidden="true" />
              Calculating route…
            </span>
          ) : (
            <>
              {routeInfo?.distance && <span>{routeInfo.distance}</span>}
              {routeInfo?.distance && routeInfo?.duration && <span className="plan-route-card-dot">·</span>}
              {routeInfo?.duration && <span>{routeInfo.duration}</span>}
            </>
          )}
        </div>
      </div>
      {chips.length > 0 && (
        <div className="plan-route-card-chips">
          {chips.map(chip => (
            <span className="plan-route-card-chip" key={chip}>{chip}</span>
          ))}
        </div>
      )}
    </div>
  );
}
