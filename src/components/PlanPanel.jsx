/** Floating planner panel — question flow and budget (footer docked in App.jsx). */
import { isScenicRoute } from "../lib/vehicles.js";
import BudgetCard from "./BudgetCard.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import SummaryCard from "./SummaryCard.jsx";
import QuestionProgress from "./QuestionProgress.jsx";
import QuestionAnswerSidebar from "./QuestionAnswerSidebar.jsx";
import PlanRouteCard from "./PlanRouteCard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import StalePlanNotice from "./StalePlanNotice.jsx";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { preloadGenerationStreamOverlay } from "../lib/preloadGenerationLoader.js";
import { getPlanFlowLayoutClass } from "../lib/tripFlow.js";

function warmGenerationLoader() {
  preloadGenerationStreamOverlay().catch(() => undefined);
}

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
  toolbarInHeader = false,
  routeError = null,
  onRetryRoute,
  planOutOfDate = false,
  planChanges = [],
  generationError = null,
  roadStops,
  selectedLodging,
  restaurantsByCity = {},
  convoEndRef,
  convoScrollRef,
  creditsLabel,
  creditsNudge = null,
  creditsExhausted = false,
  showGuestSaveHint = false,
  onGuestSignIn,
  onUpgrade,
  onGenerateTrip,
  onCancelGenerate,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetPrefDraft,
  onSkipRoutePending,
  onRoutePendingTimeout,
  continuousDriveConfirm = null,
  onConfirmContinuousDrive,
  onCancelContinuousDrive,
  onEditQuestion,
  getStepMessage,
}) {
  const stepMessage = getStepMessage?.() ?? "";
  const frozen = !!stepAnim;
  const planFlowLayout = getPlanFlowLayoutClass(currentQuestion, convoComplete);
  const showProgress = (currentQuestion || convoComplete) && flowProgress?.phases?.length > 0;
  const routePending = Boolean(currentQuestion?.pendingRoute);
  const showContinuousConfirm = Boolean(continuousDriveConfirm);
  const hideStepBubble = inQuestionFlow && (
    currentQuestion?.type === "lodging_stay"
    || currentQuestion?.type === "trip_details"
    || (currentQuestion?.type === "multiselect" && planFlowLayout === "tall")
  );

  return (
    <div className={`chat-wrap chat-wrap-plan${inQuestionFlow ? " chat-wrap-plan-flow" : ""}`}>
      <div className="convo-stage">
        {!inQuestionFlow && (
          <div className="chat-header">
            <div className="chat-title">Plan your trip.</div>
          </div>
        )}

        {inQuestionFlow && !toolbarInHeader && (
          <div className="plan-flow-toolbar">
            <div className="plan-flow-toolbar-left">
              {showProgress && <QuestionProgress {...flowProgress} compact />}
            </div>
            {creditsLabel && (
              <div className="plan-flow-toolbar-center">
                <span className="plan-flow-credits" style={{ color: "var(--text-secondary)" }}>{creditsLabel}</span>
                {creditsNudge && (
                  <span className="plan-flow-credits-nudge" style={{ color: "var(--accent)" }}>{creditsNudge}</span>
                )}
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
            questionHistory={questionHistory}
            routePending={routePending && !routeError}
            routeError={routeError}
            onRetryRoute={onRetryRoute}
          />
        )}

        {inQuestionFlow && showGuestSaveHint && onGuestSignIn && (
          <div className="plan-flow-guest-hint">
            <span className="plan-flow-guest-hint-text">Sign in to save your answers and pick up later.</span>
            <button type="button" className="plan-flow-guest-hint-btn" onClick={onGuestSignIn}>Sign in</button>
          </div>
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

        {generationError && convoComplete && (
          <div className="plan-generation-error" role="alert">
            {generationError}
          </div>
        )}

        <div className="convo-scroll" ref={convoScrollRef}>
          <div className="plan-view">
            {(currentQuestion || qIndex === -2) && (
              <div className={`plan-flow-stack${convoComplete ? " plan-flow-stack-payoff" : ""}${planFlowLayout === "sparse" ? " plan-flow-stack--sparse" : ""}`}>
                <div className="plan-flow-body">
                  <div className="plan-flow-main">
                    <div
                      className={`ai-msg plan-flow-current plan-flow-layout--${planFlowLayout}${convoComplete ? " ai-msg-payoff" : ""}${stepAnim?.phase === "exit" ? " step-exit" : ""}${enterAnim && !stepAnim ? " step-enter" : ""}`}
                    >
                  {stepMessage && !showContinuousConfirm && !hideStepBubble && (
                    <div className="ai-bubble">
                      {stepMessage}
                      {currentQuestion?.mediumTripHint && (
                        <div className="question-hint">{currentQuestion.mediumTripHint}</div>
                      )}
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
                  {showContinuousConfirm && (
                    <div className="ai-bubble">
                      <p className="continuous-drive-confirm-msg">{continuousDriveConfirm.warn}</p>
                      <p className="question-hint">
                        Confirm you intend to drive straight through without an overnight stop.
                      </p>
                      <div className="pref-actions-row">
                        <button
                          type="button"
                          className="btn-generate btn-generate-inline"
                          disabled={frozen}
                          onClick={() => { triggerPrimaryHaptic(); onConfirmContinuousDrive?.(); }}
                        >
                          Yes, drive straight through
                        </button>
                        <button
                          type="button"
                          className="convo-nav-btn"
                          disabled={frozen}
                          onClick={onCancelContinuousDrive}
                        >
                          Go back
                        </button>
                      </div>
                    </div>
                  )}
                  {currentQuestion && !showContinuousConfirm && (
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
                        onSkipRoutePending={onSkipRoutePending}
                        onRoutePendingTimeout={onRoutePendingTimeout}
                      />
                    </ErrorBoundary>
                  )}
                  {qIndex === -2 && convoComplete && (
                    <div className="payoff-summary-wrap">
                      <SummaryCard
                        answers={answers}
                        compactGrid
                        editable={returnedFromResults || convoComplete}
                        questionHistory={questionHistory}
                        onEditQuestion={onEditQuestion}
                      />
                    </div>
                  )}
                    </div>
                  </div>
                  {inQuestionFlow && !convoComplete && (
                    <QuestionAnswerSidebar history={questionHistory} />
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
        {(inQuestionFlow || returnedFromResults) && convoComplete && (
          <div className="plan-generate-sticky">
            {creditsExhausted && onUpgrade ? (
              <button type="button" className="btn-generate-trip btn-generate-trip-upgrade" onClick={onUpgrade}>
                Upgrade for more generations — Trailblazer includes 100/mo
              </button>
            ) : (
              <button
                type="button"
                className="btn-generate-trip btn-generate-trip--pulse"
                onMouseEnter={warmGenerationLoader}
                onFocus={warmGenerationLoader}
                onClick={() => { triggerPrimaryHaptic(); onGenerateTrip?.(); }}
                disabled={loading}
              >
                {loading ? (
                  <RouteDrawingLoader variant="button" />
                ) : (
                  <>
                    Generate My Trip →
                    {creditsLabel && (
                      <span className="generate-credits-badge" style={{ color: "var(--text-secondary)" }}>
                        {creditsLabel}
                      </span>
                    )}
                  </>
                )}
              </button>
            )}
            {creditsNudge && convoComplete && !creditsExhausted && (
              <p className="plan-credits-nudge" style={{ color: "var(--accent)", margin: "8px 0 0", fontSize: "0.875rem" }}>
                {creditsNudge}
              </p>
            )}
            {loading && onCancelGenerate && (
              <button type="button" className="btn-cancel-generate" onClick={onCancelGenerate}>
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
