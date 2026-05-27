/** Floating planner panel — question flow, budget, route footer. */
import { isScenicRoute } from "../lib/vehicles.js";
import BudgetCard from "./BudgetCard.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import SummaryCard from "./SummaryCard.jsx";
import RouteFooter from "./RouteFooter.jsx";
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
  origin,
  dest,
  roadStops,
  selectedLodging,
  isLoaded,
  timingMode,
  arriveByDate,
  originRef,
  destRef,
  convoEndRef,
  convoScrollRef,
  creditsLabel,
  onGenerateTrip,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetAnswers,
  onSetPrefDraft,
  onSwapRoute,
  onFetchDirections,
  onSetOrigin,
  onSetDest,
  onSetTimingMode,
  onSetArriveByDate,
  getStepMessage,
}) {
  return (
    <div className="chat-wrap">
      <div className="convo-stage">
        <div className="chat-header">
          <div className="chat-title">Plan your trip.</div>
        </div>
        {(currentQuestion || convoComplete) && flowProgress?.totalSteps > 0 && (
          <QuestionProgress {...flowProgress} />
        )}
        {returnedFromResults && (
          <div className="plan-saved-note">Your previous answers are saved</div>
        )}
        <div className="convo-scroll" ref={convoScrollRef}>
          <div className="plan-view">
            {answers.vehicle && routeInfo?.distance && (
              <BudgetCard
                compact
                answers={answers}
                routeInfo={routeInfo}
                tripLegs={tripLegs}
                roadStops={roadStops}
                selectedLodging={selectedLodging}
              />
            )}
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
            <div ref={convoEndRef}/>
          </div>
        </div>
      </div>
      <RouteFooter
        isLoaded={isLoaded}
        origin={origin}
        dest={dest}
        answers={answers}
        timingMode={timingMode}
        arriveByDate={arriveByDate}
        originRef={originRef}
        destRef={destRef}
        onSwap={onSwapRoute}
        onFetchDirections={onFetchDirections}
        onSetOrigin={onSetOrigin}
        onSetDest={onSetDest}
        onSetTimingMode={onSetTimingMode}
        onSetArriveByDate={onSetArriveByDate}
      />
    </div>
  );
}
