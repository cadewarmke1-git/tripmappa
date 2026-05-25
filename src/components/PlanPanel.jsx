/** Floating planner panel — question flow, budget, route footer, and generated stops. */
import { isScenicRoute } from "../lib/vehicles.js";
import BudgetCard from "./BudgetCard.jsx";
import QuestionChoices from "./QuestionChoices.jsx";
import StopsResults from "./StopsResults.jsx";
import SummaryCard from "./SummaryCard.jsx";
import RouteFooter from "./RouteFooter.jsx";

export default function PlanPanel({
  generated,
  stops,
  roadStops,
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
  origin,
  dest,
  tripTips,
  isLoaded,
  timingMode,
  arriveByDate,
  originRef,
  destRef,
  convoEndRef,
  stopsEndRef,
  onGenerateTrip,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetAnswers,
  onSetPrefDraft,
  onSaveTrip,
  onToast,
  onToastGold,
  onAddFuelStop,
  onLodgingSelect,
  selectedLodging,
  tripAlerts,
  onDismissAlert,
  optionalStopCards,
  activeDayIndex,
  onDaySelect,
  onFocusMap,
  onAddRoadStop,
  departureTime,
  onSwapRoute,
  onFetchDirections,
  onSetOrigin,
  onSetDest,
  onSetTimingMode,
  onSetArriveByDate,
  onRetryGenerate,
  getStepMessage,
}) {
  return (
    <div className="chat-wrap">
      <div className="convo-stage">
        {!generated && (
          <div className="chat-header">
            <div className="chat-title">Plan your trip.</div>
          </div>
        )}
        <div className="convo-scroll">
          {generated ? (
            (stops.length > 0 || roadStops.length > 0) ? (
              <StopsResults
                origin={origin}
                dest={dest}
                answers={answers}
                stops={stops}
                roadStops={roadStops}
                tripTips={tripTips}
                routeInfo={routeInfo}
                tripLegs={tripLegs}
                onResetPlan={onResetPlan}
                onSaveTrip={onSaveTrip}
                onToast={onToast}
                onAddFuelStop={onAddFuelStop}
                onLodgingSelect={onLodgingSelect}
                selectedLodging={selectedLodging}
                tripAlerts={tripAlerts}
                onDismissAlert={onDismissAlert}
                optionalStopCards={optionalStopCards}
                activeDayIndex={activeDayIndex}
                onDaySelect={onDaySelect}
                onFocusMap={onFocusMap}
                onAddRoadStop={onAddRoadStop}
                departureTime={departureTime}
                stopsEndRef={stopsEndRef}
              />
            ) : (
              <div className="empty-state" style={{ padding: "40px 16px" }}>
                <div className="empty-title">No stops returned</div>
                <div className="empty-sub" style={{ marginBottom: 16 }}>Something went wrong loading your plan. Try generating again.</div>
                <button type="button" className="btn-generate" style={{ width: "auto", padding: "10px 24px", display: "inline-block" }} onClick={onRetryGenerate}>Try again</button>
              </div>
            )
          ) : (
            <div className="plan-view">
              {answers.vehicle && routeInfo?.distance && (
                <BudgetCard
                  answers={answers}
                  routeInfo={routeInfo}
                  tripLegs={tripLegs}
                  roadStops={roadStops}
                  selectedLodging={selectedLodging}
                />
              )}
              {(currentQuestion || qIndex === -2) && (
                <div
                  className={`ai-msg${stepAnim?.phase === "exit" ? " step-exit" : ""}${enterAnim && !stepAnim ? " step-enter" : ""}`}
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
                  {qIndex === -2 && (
                    <div className="question-choices" style={{ borderTop: "none", paddingTop: 16, marginTop: 16 }}>
                      <SummaryCard answers={answers} />
                    </div>
                  )}
                </div>
              )}
              <div ref={convoEndRef}/>
            </div>
          )}
        </div>
        {convoComplete && !generated && (
          <div className="generate-wrap generate-wrap-payoff">
            <button type="button" className="btn-generate-trip" onClick={onGenerateTrip} disabled={loading}>
              {loading ? <><span className="spinner"/>Planning your trip…</> : "Generate My Trip →"}
            </button>
          </div>
        )}
      </div>
      {!generated && (
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
      )}
    </div>
  );
}
