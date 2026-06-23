import { isContinuousDrive } from "../lib/driveMode.js";
import { dedupeQuestionHistoryById, formatFlowAnswer, getAssumedTruckLodgingPill } from "../lib/tripFlow.js";
import { formatTravelersLabel, isScenicRoute } from "../lib/vehicles.js";
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
  onEditAssumedLodging,
}) {
  const ready = Boolean(routeInfo?.distance || routeInfo?.duration);
  const assumedLodging = getAssumedTruckLodgingPill(answers, questionHistory);

  const defaultChips = [
    answers.vehicle,
    formatTravelersLabel(answers.travelers),
    isScenicRoute(answers) && "Scenic",
    isContinuousDrive(answers) && "Straight through",
    answers.overnight_preference === "Stop overnight along the way" && "Overnights",
    answers.lodging && answers.lodging !== "No overnight stay" && !assumedLodging && answers.lodging,
  ].filter(Boolean);

  const defaultChipQuestionIds = new Set();
  if (answers.vehicle) defaultChipQuestionIds.add("vehicle");
  if (answers.travelers != null) {
    defaultChipQuestionIds.add("travelers");
    defaultChipQuestionIds.add("party_composition");
  }
  if (isScenicRoute(answers)) defaultChipQuestionIds.add("preferences");
  if (isContinuousDrive(answers) || answers.overnight_preference === "Stop overnight along the way") {
    defaultChipQuestionIds.add("overnight_preference");
  }
  if (answers.lodging && answers.lodging !== "No overnight stay" && !assumedLodging) {
    defaultChipQuestionIds.add("lodging");
    defaultChipQuestionIds.add("lodging_stay");
  }

  const historyChips = dedupeQuestionHistoryById(questionHistory)
    .filter(entry => !defaultChipQuestionIds.has(entry.question?.id))
    .map(entry => ({
      key: entry.question?.id ?? "q",
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
      {assumedLodging && (
        <div className="plan-route-card-chips plan-route-card-chips--assumed" aria-label="Assumed lodging">
          <span className="plan-route-card-chip plan-route-card-chip--assumed">
            {assumedLodging.lodging}
            <span className="plan-route-card-chip-assumed-tag">assumed</span>
            {onEditAssumedLodging && (
              <button
                type="button"
                className="plan-route-card-chip-edit"
                onClick={onEditAssumedLodging}
              >
                Edit
              </button>
            )}
          </span>
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
