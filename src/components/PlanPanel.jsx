/** Floating planner panel — form-on-paper question flow and ready screen. */
import { useEffect } from "react";
import { isScenicRoute } from "../lib/vehicles.js";
import QuestionChoices from "./QuestionChoices.jsx";
import QuestionProgress from "./QuestionProgress.jsx";
import QuestionAnswerSidebar from "./QuestionAnswerSidebar.jsx";
import PlanRouteCard from "./PlanRouteCard.jsx";
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
  inQuestionFlow = false,
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
  routeScoutLine = null,
  onDockActionsChange,
}) {
  const assumedLodging = getAssumedTruckLodgingPill(answers, questionHistory);
  const frozen = !!stepAnim;
  const planFlowLayout = getPlanFlowLayoutClass(currentQuestion, convoComplete);
  const showProgress = (currentQuestion || convoComplete) && flowProgress?.phases?.length > 0;
  const routePending = Boolean(currentQuestion?.pendingRoute);
  const showContinuousConfirm = Boolean(continuousDriveConfirm);
  const showQuestionHeader = inQuestionFlow && currentQuestion && !showContinuousConfirm && !convoComplete;
  const showFlowSidebar = inQuestionFlow && questionHistory.length > 0 && !convoComplete && !showContinuousConfirm;
  const showReadySidebar = inQuestionFlow && convoComplete && (questionHistory.length > 0 || assumedLodging);
  const actionsInDock = inQuestionFlow && !convoComplete;

  useEffect(() => {
    if (!actionsInDock || !onDockActionsChange) return undefined;
    if (showContinuousConfirm) {
      onDockActionsChange({
        visible: true,
        showStartOver: !frozen,
        showBack: true,
        onBack: onCancelContinuousDrive,
        showContinue: true,
        continueLabel: "Yes, drive straight through",
        continueDisabled: frozen,
        onContinue: () => { triggerPrimaryHaptic(); onConfirmContinuousDrive?.(); },
        showSkip: false,
      });
      return () => onDockActionsChange(null);
    }
    return undefined;
  }, [
    actionsInDock,
    onDockActionsChange,
    showContinuousConfirm,
    frozen,
    onCancelContinuousDrive,
    onConfirmContinuousDrive,
  ]);

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
    <div className={`plan-flow-form${inQuestionFlow ? " plan-flow-form--active" : ""}`}>
      {!inQuestionFlow && (
        <div className="plan-flow-form-intro">
          <div className="plan-flow-form-title">Plan your trip.</div>
          {showProgress && <QuestionProgress {...flowProgress} compact={false} />}
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

      {inQuestionFlow && showGuestSaveHint && onGuestSignIn && (
        <div className="plan-flow-guest-hint">
          <span className="plan-flow-guest-hint-text">Sign in to save your answers and pick up later.</span>
          <button type="button" className="plan-flow-guest-hint-btn" onClick={onGuestSignIn}>Sign in</button>
        </div>
      )}

      {planOutOfDate && (
        <StalePlanNotice onRegenerate={onGenerateTrip} loading={loading} changes={planChanges} />
      )}

      {showFlowSidebar && (
        <QuestionAnswerSidebar
          history={questionHistory}
          variant="flow"
          onEditQuestion={onEditQuestion}
        />
      )}

      <div className="plan-flow-form-body" ref={convoScrollRef}>
        {(currentQuestion || qIndex === -2) && (
          <div className={`plan-flow-stack${convoComplete ? " plan-flow-stack-payoff" : ""}${planFlowLayout === "sparse" ? " plan-flow-stack--sparse" : ""}`}>
            {convoComplete && inQuestionFlow ? (
              <div className="plan-ready-screen">
                <div className="plan-ready-body">
                  <div className="plan-ready-main">
                    <p className="plan-ready-eyebrow">Ready when you are</p>
                    <h2 className="plan-ready-heading">Your route, verified stops, and personalized itinerary — ready in seconds</h2>
                    <p className="plan-ready-subtitle">
                      No cross-referencing maps, reviews, and hotel listings — your route is built and ready to go.
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
                      {currentQuestion.ask && (
                        <h2 className="plan-flow-question-title">{currentQuestion.ask}</h2>
                      )}
                      {currentQuestion.hint && (
                        <p className="plan-flow-question-hint">{currentQuestion.hint}</p>
                      )}
                      {currentQuestion.mediumTripHint && (
                        <p className="plan-flow-question-hint">{currentQuestion.mediumTripHint}</p>
                      )}
                      {isScenicRoute(answers) && (
                        <p className="plan-flow-question-hint scenic-route-note">
                          I&apos;ll find the most scenic roads for your trip.
                        </p>
                      )}
                    </div>
                  )}

                  {showContinuousConfirm && (
                    <div className="plan-flow-confirm-panel">
                      <p className="plan-flow-confirm-msg">{continuousDriveConfirm.warn}</p>
                      <p className="plan-flow-question-hint">
                        Confirm you intend to drive straight through without an overnight stop.
                      </p>
                    </div>
                  )}

                  {currentQuestion && !showContinuousConfirm && (
                    <ErrorBoundary label="question-choices" title="Could not show choices">
                      <div
                        className={`plan-flow-step plan-flow-layout--${planFlowLayout}${stepAnim?.phase === "exit" ? " step-exit" : ""}${enterAnim && !stepAnim ? " step-enter" : ""}`}
                      >
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
                          actionsInDock={actionsInDock}
                          onDockActionsChange={showContinuousConfirm ? undefined : onDockActionsChange}
                          onResetPlan={onResetPlan}
                          onGoBack={onGoBack}
                          onPickAnswer={onPickAnswer}
                          onSetPrefDraft={onSetPrefDraft}
                          onSkipRoutePending={onSkipRoutePending}
                          onRoutePendingTimeout={onRoutePendingTimeout}
                        />
                      </div>
                    </ErrorBoundary>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={convoEndRef} />
      </div>
    </div>
  );
}
