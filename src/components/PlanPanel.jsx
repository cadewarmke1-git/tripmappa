/** Floating planner panel — question flow and ready screen (footer docked in App.jsx). */
import { isScenicRoute } from "../lib/vehicles.js";
import HeroExploreRange from "./HeroExploreRange.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import QuestionProgress from "./QuestionProgress.jsx";
import QuestionAnswerSidebar from "./QuestionAnswerSidebar.jsx";
import PlanRouteCard from "./PlanRouteCard.jsx";
import PlanGuestInvite from "./PlanGuestInvite.jsx";
import PlanFuelEstimateFooter from "./PlanFuelEstimateFooter.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import StalePlanNotice from "./StalePlanNotice.jsx";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { preloadGenerationStreamOverlay } from "../lib/preloadGenerationLoader.js";
import { getAssumedTruckLodgingPill, getPlanFlowLayoutClass } from "../lib/tripFlow.js";

function warmGenerationLoader() {
  preloadGenerationStreamOverlay().catch(() => undefined);
}

export default function PlanPanel({
  qIndex,
  currentQuestion,
  convoComplete,
  loading,
  answers,
  committedAnswers,
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
  convoEndRef,
  convoScrollRef,
  creditsLabel,
  creditsNudge = null,
  creditsExhausted = false,
  showGuestSaveHint = false,
  showGuestSignInGate = false,
  onGuestSignUp,
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
  onEditAssumedLodging,
  getStepMessage,
  exploreRangeEnabled = false,
  exploreRangeDriveSeconds = 7200,
  exploreRangeLoading = false,
  exploreRangeError = null,
  onExploreRangeToggle,
  onExploreRangeDriveTimeChange,
  routeScoutLine = null,
}) {
  const stepMessage = getStepMessage?.() ?? "";
  const assumedLodging = getAssumedTruckLodgingPill(answers, questionHistory);
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
  const showQuestionHeader = inQuestionFlow && currentQuestion && !showContinuousConfirm
    && !showGuestSignInGate && !convoComplete;
  const showFlowSidebar = inQuestionFlow && questionHistory.length > 0 && !convoComplete;
  const showReadySidebar = inQuestionFlow && convoComplete && (questionHistory.length > 0 || assumedLodging);

  function renderGenerateButton({ className = "btn-generate-trip btn-generate-trip--pulse" } = {}) {
    if (creditsExhausted && onUpgrade) {
      return (
        <button type="button" className="btn-generate-trip btn-generate-trip-upgrade" onClick={onUpgrade}>
          Upgrade for more trip generations — Trailblazer includes 100/mo
        </button>
      );
    }
    return (
      <button
        type="button"
        className={className}
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
              <span className="generate-credits-badge">{creditsLabel}</span>
            )}
          </>
        )}
      </button>
    );
  }

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
            onEditAssumedLodging={onEditAssumedLodging}
          />
        )}

        {inQuestionFlow && origin?.trim() && (
          <HeroExploreRange
            enabled={exploreRangeEnabled}
            driveTimeSeconds={exploreRangeDriveSeconds}
            loading={exploreRangeLoading}
            error={exploreRangeError}
            onToggle={onExploreRangeToggle}
            onDriveTimeChange={onExploreRangeDriveTimeChange}
          />
        )}

        {inQuestionFlow && showGuestSaveHint && !showGuestSignInGate && onGuestSignIn && (
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
          <div className="plan-generation-error plan-generation-error--prominent" role="alert">
            <p className="plan-generation-error-text">{generationError}</p>
            <button
              type="button"
              className="btn-generate-trip plan-generation-error-retry"
              onClick={() => { triggerPrimaryHaptic(); onGenerateTrip?.(); }}
              disabled={loading}
            >
              {loading ? "Retrying…" : "Try again"}
            </button>
          </div>
        )}

        <div className="convo-scroll" ref={convoScrollRef}>
          <div className="plan-view">
            {(currentQuestion || qIndex === -2) && (
              <div className={`plan-flow-stack${convoComplete ? " plan-flow-stack-payoff" : ""}${planFlowLayout === "sparse" ? " plan-flow-stack--sparse" : ""}`}>
                {convoComplete && inQuestionFlow ? (
                  <div className="plan-ready-screen">
                    <div className="plan-ready-body">
                      <div className="plan-ready-main">
                        <p className="plan-ready-eyebrow">Ready when you are</p>
                        <h2 className="plan-ready-heading">Your route, verified stops, and personalized itinerary — ready in seconds</h2>
                        <p className="plan-ready-subtitle">
                          No cross-referencing maps, reviews, and hotel listings — your full drive is built and ready to go.
                        </p>
                        {routeScoutLine && (
                          <p className="plan-ready-scout" role="status">{routeScoutLine}</p>
                        )}
                        {generationError ? (
                          <div className="plan-generation-error plan-generation-error--ready" role="alert">
                            <p className="plan-generation-error-title">Trip generation didn&apos;t finish</p>
                            <p className="plan-generation-error-text">{generationError}</p>
                            <button
                              type="button"
                              className="btn-generate-trip btn-generate-trip-ready btn-generate-trip--pulse plan-generation-error-retry"
                              onClick={() => { triggerPrimaryHaptic(); onGenerateTrip?.(); }}
                              disabled={loading}
                            >
                              {loading ? "Retrying…" : "Try again"}
                            </button>
                          </div>
                        ) : (
                          renderGenerateButton({ className: "btn-generate-trip btn-generate-trip-ready btn-generate-trip--pulse" })
                        )}
                        {creditsNudge && !creditsExhausted && (
                          <p className="plan-credits-nudge plan-ready-credits-nudge">{creditsNudge}</p>
                        )}
                        {loading && onCancelGenerate && (
                          <button type="button" className="btn-cancel-generate" onClick={onCancelGenerate}>
                            Cancel
                          </button>
                        )}
                      </div>
                      {showReadySidebar && (
                        <QuestionAnswerSidebar
                          history={questionHistory}
                          variant="ready"
                          onEditQuestion={onEditQuestion}
                          assumedLodging={assumedLodging}
                          onEditAssumedLodging={onEditAssumedLodging}
                        />
                      )}
                    </div>
                    <PlanFuelEstimateFooter
                      answers={answers}
                      routeInfo={routeInfo}
                      tripLegs={tripLegs}
                    />
                  </div>
                ) : (
                  <div className="plan-flow-body">
                    <div className="plan-flow-main">
                      {showQuestionHeader && (
                        <div className="plan-flow-question-header">
                          {showProgress && flowProgress && (
                            <p className="plan-flow-step-label">
                              Step {flowProgress.stepIndex} of {flowProgress.stepTotal} · {flowProgress.phaseLabel}
                            </p>
                          )}
                          {!hideStepBubble && currentQuestion.ask && (
                            <h2 className="plan-flow-question-title">{currentQuestion.ask}</h2>
                          )}
                          {!hideStepBubble && currentQuestion.hint && (
                            <p className="plan-flow-question-hint">{currentQuestion.hint}</p>
                          )}
                          {!hideStepBubble && currentQuestion.mediumTripHint && (
                            <p className="plan-flow-question-hint">{currentQuestion.mediumTripHint}</p>
                          )}
                          {!hideStepBubble && isScenicRoute(answers) && (
                            <p className="plan-flow-question-hint scenic-route-note">
                              I&apos;ll find the most scenic roads for your trip.
                            </p>
                          )}
                        </div>
                      )}
                      <div
                        className={`ai-msg plan-flow-current plan-flow-layout--${planFlowLayout}${stepAnim?.phase === "exit" ? " step-exit" : ""}${enterAnim && !stepAnim ? " step-enter" : ""}`}
                      >
                        {!inQuestionFlow && stepMessage && !showContinuousConfirm && !hideStepBubble && (
                          <div className="ai-bubble">
                            {stepMessage}
                            {currentQuestion?.mediumTripHint && (
                              <div className="question-hint">{currentQuestion.mediumTripHint}</div>
                            )}
                            {currentQuestion?.hint && (
                              <div className="question-hint">{currentQuestion.hint}</div>
                            )}
                          </div>
                        )}
                        {showContinuousConfirm && (
                          <div className="ai-bubble">
                            <p className="continuous-drive-confirm-msg">{continuousDriveConfirm.warn}</p>
                            <p className="question-hint">
                              Confirm you intend to drive straight through without an overnight stop.
                            </p>
                            <div className="pref-actions-row plan-flow-actions">
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
                        {showGuestSignInGate && onGuestSignUp && onGuestSignIn && (
                          <PlanGuestInvite onSignUp={onGuestSignUp} onSignIn={onGuestSignIn} />
                        )}
                        {currentQuestion && !showContinuousConfirm && !showGuestSignInGate && (
                          <ErrorBoundary label="question-choices" title="Could not show choices">
                            <QuestionChoices
                              currentQ={currentQuestion}
                              stepAnim={stepAnim}
                              answers={answers}
                              committedAnswers={committedAnswers}
                              prefDraft={prefDraft}
                              questionHistory={questionHistory}
                              questionHistoryLength={questionHistoryLength}
                              compact={inQuestionFlow}
                              planFlowLayout={planFlowLayout}
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
                      </div>
                    </div>
                    {showFlowSidebar && (
                      <QuestionAnswerSidebar
                        history={questionHistory}
                        variant="flow"
                        onEditQuestion={onEditQuestion}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
            <div ref={convoEndRef}/>
          </div>
        </div>
        {(inQuestionFlow || returnedFromResults) && convoComplete && !inQuestionFlow && (
          <div className="plan-generate-sticky">
            {renderGenerateButton()}
            {creditsNudge && !creditsExhausted && (
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
