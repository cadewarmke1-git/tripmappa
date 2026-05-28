/** Floating planner panel — question flow and budget (footer docked in App.jsx). */
import { isScenicRoute } from "../lib/vehicles.js";
import BudgetCard from "./BudgetCard.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import SummaryCard from "./SummaryCard.jsx";
import QuestionProgress from "./QuestionProgress.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

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
  const stepMessage = getStepMessage?.() ?? "";
  const frozen = !!stepAnim;
  const showProgress = (currentQuestion || convoComplete) && flowProgress?.totalSteps > 0;

  return (
    <div className={`chat-wrap chat-wrap-plan${inQuestionFlow ? " chat-wrap-plan-flow" : ""}`}>
      <div className="convo-stage">
        {!inQuestionFlow && (
          <div className="chat-header">
            <div className="chat-title">Plan your trip.</div>
          </div>
        )}

        {inQuestionFlow && showProgress && (
          <div className="plan-flow-toolbar">
            <QuestionProgress {...flowProgress} compact />
            <div className="plan-flow-nav">
              {!frozen && (
                <button type="button" className="convo-nav-btn" onClick={onResetPlan}>Start over</button>
              )}
              {questionHistoryLength > 0 && !frozen && (
                <button type="button" className="convo-nav-btn" onClick={onGoBack}>← Back</button>
              )}
            </div>
          </div>
        )}

        {!inQuestionFlow && showProgress && (
          <QuestionProgress {...flowProgress} compact={false} />
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
                {stepMessage && (
                  <div className="ai-bubble">
                    {stepMessage}
                    {isScenicRoute(answers) && (
                      <div className="scenic-route-note" style={{ marginTop: inQuestionFlow ? 6 : 12 }}>
                        I&apos;ll find the most scenic roads for your trip.
                      </div>
                    )}
                  </div>
                )}
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
                  <ErrorBoundary label="question-choices" title="Could not show choices">
                    <QuestionChoices
                      currentQ={currentQuestion}
                      stepAnim={stepAnim}
                      answers={answers}
                      prefDraft={prefDraft}
                      prefSkipReady={prefSkipReady}
                      questionHistoryLength={questionHistoryLength}
                      compact={inQuestionFlow}
                      showNavRow={!inQuestionFlow}
                      onResetPlan={onResetPlan}
                      onGoBack={onGoBack}
                      onPickAnswer={onPickAnswer}
                      onSetAnswers={onSetAnswers}
                      onSetPrefDraft={onSetPrefDraft}
                    />
                  </ErrorBoundary>
                )}
                {qIndex === -2 && convoComplete && (
                  <div className="payoff-summary-wrap">
                    <SummaryCard answers={answers} />
                  </div>
                )}
              </div>
            )}
            {!inQuestionFlow && answers.vehicle && routeInfo?.distance && (
              <ErrorBoundary label="budget-card" title="Could not show budget estimate">
                <BudgetCard
                  compact
                  answers={answers}
                  routeInfo={routeInfo}
                  tripLegs={tripLegs}
                  roadStops={roadStops}
                  selectedLodging={selectedLodging}
                  restaurantsByCity={restaurantsByCity}
                />
              </ErrorBoundary>
            )}
            <div ref={convoEndRef}/>
          </div>
        </div>
      </div>
    </div>
  );
}
