import { isContinuousDrive } from "../lib/driveMode.js";
import { formatFlowAnswer } from "../lib/tripFlow.js";
import { isScenicRoute } from "../lib/vehicles.js";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";

export default function PlanRouteCard({
  origin,
  dest,
  routeInfo,
  answers = {},
  questionHistory = [],
  routePending = false,
  routeError = null,
  onRetryRoute,
}) {
  const ready = Boolean(routeInfo?.distance || routeInfo?.duration);

  const defaultChips = [
    answers.vehicle,
    answers.travelers && `${answers.travelers} traveler${answers.travelers === "1" ? "" : "s"}`,
    isScenicRoute(answers) && "Scenic",
    isContinuousDrive(answers) && "Straight through",
    answers.overnight_preference === "Stop overnight along the way" && "Overnights",
    answers.lodging && answers.lodging !== "No overnight stay" && answers.lodging,
  ].filter(Boolean);

  const historyChips = questionHistory.map((entry, index) => ({
    key: `${entry.question?.id ?? "q"}-${index}`,
    text: formatFlowAnswer(entry.question, entry.answer),
  })).filter(chip => chip.text);

  return (
    <div className={`plan-route-card${routePending ? " plan-route-card-pending" : ""}${routeError ? " plan-route-card-error" : ""}`}>
      <div className="plan-route-card-row">
        <div className="plan-route-card-endpoints">
          <span className="plan-route-card-city">{origin?.split(",")[0]?.trim() || "Origin"}</span>
          <span className="plan-route-card-arrow" aria-hidden="true">→</span>
          <span className="plan-route-card-city">{dest?.split(",")[0]?.trim() || "Destination"}</span>
        </div>
        <div className="plan-route-card-stats">
          {routeError ? (
            <span className="plan-route-card-error-text">{routeError}</span>
          ) : routePending || !ready ? (
            <span className="plan-route-card-loading">
              <RouteDrawingLoader variant="compact" />
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
      {routeError && onRetryRoute && (
        <button type="button" className="plan-route-retry-btn" onClick={onRetryRoute}>
          Retry route
        </button>
      )}
      {historyChips.length > 0 && (
        <div className="plan-route-card-chips plan-route-card-chips--history" aria-label="Answers so far">
          {historyChips.map(chip => (
            <span className="plan-route-card-chip" key={chip.key}>{chip.text}</span>
          ))}
        </div>
      )}
      {defaultChips.length > 0 && (
        <div className="plan-route-card-chips plan-route-card-chips--default">
          {defaultChips.map(chip => (
            <span className="plan-route-card-chip" key={chip}>{chip}</span>
          ))}
        </div>
      )}
    </div>
  );
}
