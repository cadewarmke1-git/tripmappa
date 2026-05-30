/** Floating planner panel — question flow and budget (footer docked in App.jsx). */
import { isScenicRoute } from "../lib/vehicles.js";
import BudgetCard from "./BudgetCard.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import SummaryCard from "./SummaryCard.jsx";
import QuestionProgress from "./QuestionProgress.jsx";
import QuestionThread from "./QuestionThread.jsx";
import PlanRouteCard from "./PlanRouteCard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import StalePlanNotice from "./StalePlanNotice.jsx";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";

export default function PlanPanel({
  qIndex,
  currentQuestion,
  convoComplete,
  loading,
  answers,
  origin,
  dest,
  routeInfo,
  tripLegs,
  stepAnim,
  enterAnim,
  prefDraft,
  questionHistory = [],
  questionHistoryLength,
  flowProgress,
  returnedFromResults,
  inQuestionFlow = false,
  routeError = null,
  onRetryRoute,
  planOutOfDate = false,
  planChanges = [],
  roadStops,
  selectedLodging,
  restaurantsByCity = {},
  convoEndRef,
  convoScrollRef,
  creditsLabel,
  onGenerateTrip,
  onCancelGenerate,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetAnswers,
  onSetPrefDraft,
  getStepMessage,
}) {
  const stepMessage = getStepMessage?.() ?? "";
  const frozen = !!stepAnim;
  const showProgress = (currentQuestion || convoComplete) && flowProgress?.phases?.length > 0;
  const routePending = Boolean(currentQuestion?.pendingRoute);

  return (
    <div className={`chat-wrap chat-wrap-plan${inQuestionFlow ? " chat-wrap-plan-flow" : ""}`}>
      <div className="convo-stage">
        {!inQuestionFlow && (
          <div className="chat-header">
            <div className="chat-title">Plan your trip.</div>
          </div>
        )}

        {inQuestionFlow && (
          <div className="plan-flow-toolbar">
            <div className="plan-flow-toolbar-left">
              {showProgress && <QuestionProgress {...flowProgress} compact />}
            </div>
            {creditsLabel && (
              <div className="plan-flow-toolbar-center">
                <span className="plan-flow-credits">{creditsLabel}</span>
              </div>
            )}
            <div className="plan-flow-toolbar-right">
              {!frozen && (
                <button type="button" className="convo-nav-btn plan-flow-start-over" onClick={onResetPlan}>Start over</button>
              )}
              {questionHistoryLength > 0 && !frozen && (
                <button type="button" className="convo-nav-btn" onClick={onGoBack}>← Back</button>
              )}
            </div>
          </div>
        )}

        {inQuestionFlow && (origin || dest) && (
          <PlanRouteCard
            origin={origin}
            dest={dest}
            routeInfo={routeInfo}
            answers={answers}
            routePending={routePending && !routeError}
            routeError={routeError}
            onRetryRoute={onRetryRoute}
          />
        )}

        {!inQuestionFlow && showProgress && (
          <QuestionProgress {...flowProgress} compact={false} />
        )}

        {returnedFromResults && (
          <div className="plan-saved-note">
            Editing your trip — answers are kept until you regenerate. Start over clears everything.
          </div>
        )}

        {planOutOfDate && (
          <StalePlanNotice onRegenerate={onGenerateTrip} loading={loading} changes={planChanges} />
        )}

        <div className="convo-scroll" ref={convoScrollRef}>
          <div className="plan-view">
            {(currentQuestion || qIndex === -2) && (
              <div className={`plan-flow-stack${convoComplete ? " plan-flow-stack-payoff" : ""}`}>
                <QuestionThread history={questionHistory} />

                <div
                  className={`ai-msg plan-flow-current${convoComplete ? " ai-msg-payoff" : ""}${stepAnim?.phase === "exit" ? " step-exit-fast" : ""}${enterAnim && !stepAnim ? " step-enter-fast" : ""}`}
                >
                  {stepMessage && (
                    <div className="ai-bubble">
                      {stepMessage}
                      {currentQuestion?.hint && (
                        <div className="question-hint">{currentQuestion.hint}</div>
                      )}
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
                        {loading ? (
                          <RouteDrawingLoader variant="button" />
                        ) : (
                          <>
                            Generate My Trip →
                            {creditsLabel && <span className="generate-credits-badge">{creditsLabel}</span>}
                          </>
                        )}
                      </button>
                      {loading && onCancelGenerate && (
                        <button type="button" className="btn-cancel-generate" onClick={onCancelGenerate}>
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                  {currentQuestion && (
                    <ErrorBoundary label="question-choices" title="Could not show choices">
                      <QuestionChoices
                        currentQ={currentQuestion}
                        stepAnim={stepAnim}
                        answers={answers}
                        prefDraft={prefDraft}
                        questionHistoryLength={questionHistoryLength}
                        compact={inQuestionFlow}
                        showNavRow={!inQuestionFlow}
                        onResetPlan={onResetPlan}
                        onGoBack={onGoBack}
                        onPickAnswer={onPickAnswer}
                        onSetPrefDraft={onSetPrefDraft}
                      />
                    </ErrorBoundary>
                  )}
                  {qIndex === -2 && convoComplete && (
                    <div className="payoff-summary-wrap">
                      <SummaryCard answers={answers} routeInfo={routeInfo} compactGrid />
                    </div>
                  )}
                </div>
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
