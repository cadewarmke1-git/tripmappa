/** Floating planner panel — question flow and budget (footer docked in App.jsx). */
import { isScenicRoute } from "../lib/vehicles.js";
import BudgetCard from "./BudgetCard.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import SummaryCard from "./SummaryCard.jsx";
import QuestionProgress from "./QuestionProgress.jsx";

export default function PlanPanel({
  qIndex,
  currentQuestion,
  convoComplete,
  loading,
  answers,
  routeInfo,
  tripLegs,
  stepAnim,
  enterAnim,
  prefDraft,
  prefSkipReady,
  questionHistoryLength,
  flowProgress,
  returnedFromResults,
  inQuestionFlow = false,
  roadStops,
  selectedLodging,
  restaurantsByCity = {},
  convoEndRef,
  convoScrollRef,
  creditsLabel,
  onGenerateTrip,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetAnswers,
  onSetPrefDraft,
  getStepMessage,
}) {
  return (
    <div className={`chat-wrap chat-wrap-plan${inQuestionFlow ? " chat-wrap-plan-flow" : ""}`}>
      <div className="convo-stage">
        {!inQuestionFlow && (
          <div className="chat-header">
            <div className="chat-title">Plan your trip.</div>
          </div>
        )}
        {(currentQuestion || convoComplete) && flowProgress?.totalSteps > 0 && (
          <QuestionProgress {...flowProgress} compact={inQuestionFlow} />
        )}
        {returnedFromResults && (
          <div className="plan-saved-note">Your previous answers are saved</div>
        )}
        <div className="convo-scroll" ref={convoScrollRef}>
          <div className="plan-view">
            {(currentQuestion || qIndex === -2) && (
              <div
                className={`ai-msg${convoComplete ? " ai-msg-payoff" : ""}${stepAnim?.phase === "exit" ? " step-exit" : ""}${enterAnim && !stepAnim ? " step-enter" : ""}`}
                key={currentQuestion?.id ?? qIndex}
              >
                <div className="ai-bubble">
                  {getStepMessage()}
                  {isScenicRoute(answers) && (
                    <div className="scenic-route-note" style={{ marginTop: 12 }}>
                      I&apos;ll find the most scenic roads for your trip.
                    </div>
                  )}
                </div>
                {convoComplete && (
                  <div className="generate-inline">
                    <button type="button" className="btn-generate-trip" onClick={onGenerateTrip} disabled={loading}>
                      {loading ? "Generating…" : (
                        <>
                          Generate My Trip →
                          {creditsLabel && <span className="generate-credits-badge">{creditsLabel}</span>}
                        </>
                      )}
                    </button>
                  </div>
                )}
                {currentQuestion && (
                  <QuestionChoices
                    currentQ={currentQuestion}
                    stepAnim={stepAnim}
                    answers={answers}
                    prefDraft={prefDraft}
                    prefSkipReady={prefSkipReady}
                    questionHistoryLength={questionHistoryLength}
                    compact={inQuestionFlow}
                    onResetPlan={onResetPlan}
                    onGoBack={onGoBack}
                    onPickAnswer={onPickAnswer}
                    onSetAnswers={onSetAnswers}
                    onSetPrefDraft={onSetPrefDraft}
                  />
                )}
                {qIndex === -2 && convoComplete && (
                  <div className="payoff-summary-wrap">
                    <SummaryCard answers={answers} />
                  </div>
                )}
              </div>
            )}
            {!inQuestionFlow && answers.vehicle && routeInfo?.distance && (
              <BudgetCard
                compact
                answers={answers}
                routeInfo={routeInfo}
                tripLegs={tripLegs}
                roadStops={roadStops}
                selectedLodging={selectedLodging}
                restaurantsByCity={restaurantsByCity}
              />
            )}
            <div ref={convoEndRef}/>
          </div>
        </div>
      </div>
    </div>
  );
}
