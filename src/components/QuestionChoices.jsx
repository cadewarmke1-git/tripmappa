import { useEffect, useMemo, useState } from "react";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { isQuestionConfirmedInHistory } from "../lib/generationContext.js";
import { ROUTE_PENDING_UNLOCK_MS } from "../lib/tripFlow.js";

const TRIP_DETAILS_MORE_SECTION_IDS = new Set([
  "stops_interests",
  "accessibility",
  "schedule_restrictions",
]);

function normalizeChoice(choice) {
  if (choice && typeof choice === "object" && choice.value != null) {
    return {
      value: choice.value,
      label: choice.label ?? choice.value,
      description: choice.description ?? null,
    };
  }
  return { value: choice, label: choice, description: null };
}

function isGroupDraft(prefDraft) {
  return prefDraft && typeof prefDraft === "object" && !Array.isArray(prefDraft);
}

/** Upper bound from travelers band answer already in flow (e.g. "3 to 5 travelers" → 5). */
function parseTravelersBandMax(travelers) {
  if (travelers == null || travelers === "") return null;
  const t = String(travelers);
  if (t === "1" || t === "Just me") return 1;
  if (t === "2" || t === "2 travelers") return 2;
  if (t === "3 to 5" || t === "3 to 5 travelers") return 5;
  if (t === "6 or more" || t === "6 or more travelers") return 6;
  const rangeMatch = t.match(/(\d+)\s*to\s*(\d+)/i);
  if (rangeMatch) return Number(rangeMatch[2]);
  const leading = t.match(/^(\d+)/);
  if (leading) return Number(leading[1]);
  return null;
}

function buildGroupDraft(currentQ, prefDraft, answers, { includePrefill = false } = {}) {
  const hasWorkingDraft = isGroupDraft(prefDraft);
  const draft = (includePrefill || hasWorkingDraft) && hasWorkingDraft ? { ...prefDraft } : {};
  for (const sec of currentQ?.sections || []) {
    if (!Array.isArray(draft[sec.id])) {
      draft[sec.id] = Array.isArray(answers?.[sec.id]) ? [...answers[sec.id]] : [];
    }
  }
  if (currentQ?.type === "trip_details") {
    draft.trip_budget = draft.trip_budget || answers?.trip_budget || "No budget limit";
  }
  return draft;
}

export default function QuestionChoices({
  currentQ,
  stepAnim,
  answers,
  committedAnswers,
  prefDraft,
  questionHistory = [],
  questionHistoryLength,
  compact = false,
  planFlowLayout = "standard",
  showNavRow = true,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetPrefDraft,
  onSkipRoutePending,
  onRoutePendingTimeout,
}) {
  const [vehicleTab, setVehicleTab] = useState(0);
  const [vehicleDraft, setVehicleDraft] = useState(null);
  const [lodgingDraft, setLodgingDraft] = useState(null);
  const [loyaltyDraft, setLoyaltyDraft] = useState(null);
  const [groupDraft, setGroupDraft] = useState(null);
  const [multiDraft, setMultiDraft] = useState([]);
  const [partyAdults, setPartyAdults] = useState(2);
  const [partyChildren, setPartyChildren] = useState(0);
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false);
  const [routePendingExpired, setRoutePendingExpired] = useState(false);
  const [budgetTouched, setBudgetTouched] = useState(false);

  const partyMax = useMemo(
    () => parseTravelersBandMax(answers?.travelers),
    [answers?.travelers],
  );

  useEffect(() => {
    setRoutePendingExpired(false);
    if (!currentQ?.pendingRoute) return undefined;
    const timer = setTimeout(() => {
      setRoutePendingExpired(true);
      onRoutePendingTimeout?.();
    }, ROUTE_PENDING_UNLOCK_MS);
    return () => clearTimeout(timer);
  }, [currentQ?.id, currentQ?.pendingRoute, onRoutePendingTimeout]);

  const committed = committedAnswers ?? answers;
  const questionConfirmed = useMemo(
    () => isQuestionConfirmedInHistory(currentQ?.id, questionHistory),
    [currentQ?.id, questionHistory],
  );

  useEffect(() => {
    setVehicleTab(0);
    setVehicleDraft(
      questionConfirmed && currentQ?.type === "vehicle"
        ? (committed[currentQ.id] || null)
        : null,
    );
    setLodgingDraft(null);
    setLoyaltyDraft(
      questionConfirmed && currentQ?.type === "lodging_stay"
        ? (committed.loyalty_program || null)
        : null,
    );
    setBudgetTouched(false);
  }, [currentQ?.id, currentQ?.type, committed.loyalty_program, committed, questionConfirmed]);

  useEffect(() => {
    if (currentQ?.type !== "party_composition") return;
    if (questionConfirmed) {
      setPartyAdults(committed.adult_count ?? 2);
      setPartyChildren(committed.child_count ?? 0);
    } else {
      setPartyAdults(2);
      setPartyChildren(0);
    }
  }, [currentQ?.id, currentQ?.type, questionConfirmed, committed.adult_count, committed.child_count]);

  useEffect(() => {
    if (currentQ?.type === "trip_details" || currentQ?.type === "multiselect_group") {
      setGroupDraft(buildGroupDraft(currentQ, prefDraft, committed, { includePrefill: questionConfirmed }));
      if (currentQ?.type === "trip_details") {
        setMoreOptionsExpanded(false);
      }
      return;
    }
    setGroupDraft(null);
    if (currentQ?.type === "multiselect") {
      const fromAnswers = Array.isArray(committed[currentQ.id]) ? committed[currentQ.id] : [];
      if (questionConfirmed) {
        setMultiDraft([...fromAnswers]);
      } else if (fromAnswers.length > 0) {
        setMultiDraft([...fromAnswers]);
      } else if (Array.isArray(prefDraft) && prefDraft.length > 0) {
        setMultiDraft([...prefDraft]);
      } else {
        setMultiDraft([]);
      }
      return;
    }
    setMultiDraft([]);
  }, [currentQ?.id, currentQ?.type, prefDraft, committed, questionConfirmed]);

  if (!currentQ?.id || !currentQ?.type) return null;

  const frozen = !!stepAnim;
  const selected = stepAnim?.answer;
  const choices = Array.isArray(currentQ.choices) ? currentQ.choices : [];
  const vehicleGroups = currentQ.type === "vehicle" && Array.isArray(currentQ.groups) ? currentQ.groups : null;
  const useVehicleTabs = compact && vehicleGroups;

  const committedChoiceValue = questionConfirmed ? committed[currentQ.id] : undefined;
  const prefillChoiceValue = !questionConfirmed && typeof prefDraft === "string" ? prefDraft : undefined;

  const mkClass = (val, extra = "") => {
    const sel = selected === val ? " qr-selected" : "";
    const active = committedChoiceValue === val || prefillChoiceValue === val || vehicleDraft === val || lodgingDraft === val ? " qr-selected" : "";
    return `qr-btn${extra}${sel || active}${frozen && selected !== val && committedChoiceValue !== val && prefillChoiceValue !== val && vehicleDraft !== val && lodgingDraft !== val ? " qr-dimmed" : ""}`;
  };
  const mkPrefClass = (p) => {
    const active = Array.isArray(multiDraft) ? multiDraft.includes(p) : false;
    return `qr-btn${active ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`;
  };
  const mkGroupClass = (sectionId, value) => {
    const sectionDraft = Array.isArray(groupDraft?.[sectionId]) ? groupDraft[sectionId] : [];
    return `qr-btn${sectionDraft.includes(value) ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`;
  };

  const isSingleSelect = currentQ.type === "choice" || currentQ.type === "travelers";
  const isLodgingStay = currentQ.type === "lodging_stay";
  const isTripDetails = currentQ.type === "trip_details";
  const routePending = Boolean(currentQ.pendingRoute);
  const routeLocked = routePending && !routePendingExpired;
  const budgetDraft = groupDraft?.trip_budget || "No budget limit";

  function pickInstant(value, extraFields) {
    onPickAnswer(value, extraFields, { instant: true });
  }

  function pickWithAnim(value, extraFields) {
    triggerPrimaryHaptic();
    onPickAnswer(value, extraFields);
  }

  function continueWithHaptic(handler) {
    return () => {
      triggerPrimaryHaptic();
      handler();
    };
  }

  const labeledVehicleGroups = vehicleGroups
    ? vehicleGroups.filter(g => Array.isArray(g.options) && g.options.length > 0)
    : [];
  const activeVehicleGroup = useVehicleTabs
    ? labeledVehicleGroups[Math.min(vehicleTab, labeledVehicleGroups.length - 1)]
    : null;

  function toggleGroupSection(sectionId, value) {
    const base = groupDraft ?? buildGroupDraft(currentQ, prefDraft, committed, { includePrefill: questionConfirmed });
    const section = Array.isArray(base[sectionId]) ? base[sectionId] : [];
    const next = {
      ...base,
      [sectionId]: section.includes(value)
        ? section.filter(x => x !== value)
        : [...section, value],
    };
    setGroupDraft(next);
    onSetPrefDraft(next);
  }

  function isTripDetailsDraftEmpty(draft) {
    const dietary = Array.isArray(draft.dietary) ? draft.dietary : [];
    const stops = Array.isArray(draft.stops_interests) ? draft.stops_interests : [];
    const accessibility = Array.isArray(draft.accessibility) ? draft.accessibility : [];
    const schedule = Array.isArray(draft.schedule_restrictions) ? draft.schedule_restrictions : [];
    const budget = draft.trip_budget || "No budget limit";
    return !dietary.length && !stops.length && !accessibility.length && !schedule.length && budget === "No budget limit";
  }

  function submitTripDetails() {
    const draft = groupDraft || buildGroupDraft(currentQ, prefDraft, committed, { includePrefill: questionConfirmed });
    const empty = isTripDetailsDraftEmpty(draft);
    pickInstant({
      dietary: Array.isArray(draft.dietary) ? draft.dietary : [],
      stops_interests: Array.isArray(draft.stops_interests) ? draft.stops_interests : [],
      accessibility: Array.isArray(draft.accessibility) ? draft.accessibility : [],
      schedule_restrictions: Array.isArray(draft.schedule_restrictions) ? draft.schedule_restrictions : [],
      trip_budget: draft.trip_budget || "No budget limit",
    }, { trip_details_defaults_confirmed: empty });
  }

  function skipTripDetails() {
    pickInstant({
      dietary: [],
      stops_interests: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
    }, { trip_details_defaults_confirmed: true });
  }

  function setBudgetDraft(value) {
    setBudgetTouched(true);
    const base = groupDraft ?? buildGroupDraft(currentQ, {}, committed);
    const current = base.trip_budget || "No budget limit";
    const next = { ...base, trip_budget: current === value ? "No budget limit" : value };
    setGroupDraft(next);
    onSetPrefDraft(next);
  }

  function isBudgetSelected(value) {
    if (budgetDraft !== value) return false;
    if (value === "No budget limit") return budgetTouched;
    return true;
  }

  function toggleMultiDraft(value) {
    const list = Array.isArray(multiDraft) ? multiDraft : [];
    const next = list.includes(value) ? list.filter(x => x !== value) : [...list, value];
    setMultiDraft(next);
    onSetPrefDraft(next);
  }

  function adjustPartyCount(field, delta) {
    const [min, max] = field === "adults"
      ? (currentQ.adultRange || [1, 8])
      : (currentQ.childRange || [0, 6]);
    const currentTotal = Number(partyAdults) + Number(partyChildren);
    if (delta > 0 && partyMax != null && currentTotal >= partyMax) return;

    const nextAdults = field === "adults"
      ? Math.min(max, Math.max(min, Number(partyAdults) + delta))
      : partyAdults;
    const nextChildren = field === "children"
      ? Math.min(max, Math.max(min, Number(partyChildren) + delta))
      : partyChildren;
    if (partyMax != null && nextAdults + nextChildren > partyMax) return;

    setPartyAdults(nextAdults);
    setPartyChildren(nextChildren);
    onSetPrefDraft({ adults: nextAdults, children: nextChildren });
  }

  function submitPartyComposition() {
    onPickAnswer(
      { adults: Number(partyAdults), children: Number(partyChildren) },
      {},
    );
  }

  const scrollOptions = compact
    && planFlowLayout !== "sparse"
    && currentQ.type !== "loading"
    && currentQ.type !== "text"
    && currentQ.type !== "party_composition";

  function wrapScrollable(content) {
    if (!scrollOptions) return content;
    return <div className="question-options-scroll">{content}</div>;
  }

  const actionRowClass = "pref-actions-row plan-flow-actions";

  return (
    <div className={`question-choices-shell${compact ? " question-choices-shell-compact" : ""}`}>
    <div className={`question-choices${frozen ? " choices-frozen" : ""}${compact ? " question-choices-compact" : ""}${isTripDetails ? " question-choices-trip-details" : ""}`}>
      {showNavRow && (
        <div className="convo-nav-row">
          {!frozen && (
            <button type="button" className="convo-nav-btn" onClick={onResetPlan}>Start over</button>
          )}
          {questionHistoryLength > 0 && !frozen && (
            <button type="button" className="convo-nav-btn" onClick={onGoBack}>← Back</button>
          )}
        </div>
      )}

      {currentQ.type === "loading" && (
        <div className="question-loading" aria-live="polite">
          <RouteDrawingLoader variant="inline" />
        </div>
      )}

      {isTripDetails && currentQ.pageTitle && (
        <div className="question-page-header">
          <h2 className="question-page-title">{currentQ.pageTitle}</h2>
          {currentQ.pageSubtitle && (
            <p className="question-page-subtitle">{currentQ.pageSubtitle}</p>
          )}
        </div>
      )}

      {useVehicleTabs && (
        <div className="vehicle-tabs" role="tablist" aria-label="Vehicle categories">
          {labeledVehicleGroups.map((group, idx) => (
            <button
              key={group.label || `group-${idx}`}
              type="button"
              role="tab"
              aria-selected={vehicleTab === idx}
              className={`vehicle-tab${vehicleTab === idx ? " vehicle-tab-active" : ""}`}
              disabled={frozen}
              onClick={() => setVehicleTab(idx)}
            >
              {group.label || "More"}
            </button>
          ))}
        </div>
      )}

      {wrapScrollable(
        <>
          {useVehicleTabs && activeVehicleGroup && (
            <div className="vehicle-group vehicle-group-tabbed">
              <div className="quick-replies vehicle-group-options">
                {activeVehicleGroup.options.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={mkClass(opt.value)}
                    disabled={frozen}
                    onClick={() => setVehicleDraft(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!useVehicleTabs && vehicleGroups && vehicleGroups.map(group => (
            <div key={group.label || group.options?.[0]?.value} className="vehicle-group">
              {group.label && <div className="vehicle-group-label">{group.label}</div>}
              <div className="quick-replies vehicle-group-options">
                {group.options.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={mkClass(opt.value)}
                    disabled={frozen}
                    onClick={() => setVehicleDraft(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!vehicleGroups && isSingleSelect && (
            <div className={`quick-replies quick-replies-described${currentQ.id === "fuel_type" ? " question-choices-scroll" : ""}`}>
              {routePending && routeLocked && (
                <p className="question-pending-note question-pending-note--loading">
                  <RouteDrawingLoader variant="inline" />
                  <span>Calculating your route — choices unlock in a moment.</span>
                </p>
              )}
              {routePending && routePendingExpired && (
                <p className="question-pending-note">Route details are still loading — your answer will be used as-is.</p>
              )}
              {choices.map(raw => {
                const { value, label, description } = normalizeChoice(raw);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`${mkClass(value)}${description ? " qr-btn-described" : ""}`}
                    disabled={frozen || routeLocked}
                    onClick={() => pickWithAnim(value)}
                  >
                    <span className="qr-btn-label">{label}</span>
                    {description && <span className="qr-btn-desc">{description}</span>}
                  </button>
                );
              })}
              {routePending && onSkipRoutePending && (
                <button
                  type="button"
                  className="question-skip-route-link"
                  disabled={frozen}
                  onClick={onSkipRoutePending}
                >
                  Skip for now
                </button>
              )}
              {currentQ.id === "travelers" && (
                <p className="travelers-solo-privacy-note">
                  Choosing &ldquo;Just me&rdquo;? Your trip stays private by default.
                </p>
              )}
            </div>
          )}

          {isLodgingStay && (
            <>
              {currentQ.ask && (
                <p className="question-lodging-ask">{currentQ.ask}</p>
              )}
              <div className="quick-replies quick-replies-lodging">
                {choices.map(raw => {
                  const { value, label } = normalizeChoice(raw);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={mkClass(value, " qr-btn-lodging")}
                      disabled={frozen}
                      onClick={() => pickInstant(value, { loyalty_program: loyaltyDraft || "No preference" })}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {Array.isArray(currentQ.loyaltyChoices) && currentQ.loyaltyChoices.length > 0 && (
                <div className="lodging-loyalty-section">
                  <div className="question-section-label">Hotel loyalty (optional)</div>
                  <div className="quick-replies">
                    {currentQ.loyaltyChoices.map(raw => {
                      const { value, label } = normalizeChoice(raw);
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`qr-btn${loyaltyDraft === value ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`}
                          disabled={frozen}
                          onClick={() => setLoyaltyDraft(value)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {currentQ.type === "multiselect" && (
            <div className="quick-replies">
              {choices.map(c => (
                <button
                  key={c}
                  type="button"
                  className={mkPrefClass(c)}
                  disabled={frozen}
                  onClick={() => toggleMultiDraft(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === "party_composition" && (
            <div className="party-composition-inputs">
              {partyMax != null && (
                <p className="party-composition-total">
                  Total: {Number(partyAdults) + Number(partyChildren)} / {partyMax}
                </p>
              )}
              {[
                { field: "adults", label: "Adults", value: partyAdults, range: currentQ.adultRange || [1, 8] },
                { field: "children", label: "Children", value: partyChildren, range: currentQ.childRange || [0, 6] },
              ].map(({ field, label, value, range }) => {
                const atPartyMax = partyMax != null
                  && Number(partyAdults) + Number(partyChildren) >= partyMax;
                return (
                  <div className="party-composition-row" key={field}>
                    <span className="party-composition-label">{label}</span>
                    <div className="party-composition-stepper">
                      <button
                        type="button"
                        className="party-composition-stepper-btn"
                        disabled={frozen || value <= range[0]}
                        onClick={() => adjustPartyCount(field, -1)}
                        aria-label={`Fewer ${label.toLowerCase()}`}
                      >
                        −
                      </button>
                      <span className="party-composition-value">{value}</span>
                      <button
                        type="button"
                        className="party-composition-stepper-btn"
                        disabled={frozen || value >= range[1] || atPartyMax}
                        onClick={() => adjustPartyCount(field, 1)}
                        aria-label={`More ${label.toLowerCase()}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {isTripDetails && (
            <>
              {(currentQ.sections || [])
                .filter(section => section.id === "dietary")
                .map(section => (
                  <div className="question-group-section" key={section.id}>
                    <div className="question-section-label">{section.label}</div>
                    <div className="quick-replies question-choices-scroll">
                      {(section.choices || []).map(raw => {
                        const { value, label } = normalizeChoice(raw);
                        return (
                          <button
                            key={value}
                            type="button"
                            className={mkGroupClass(section.id, value)}
                            disabled={frozen}
                            onClick={() => toggleGroupSection(section.id, value)}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              {Array.isArray(currentQ.budgetChoices) && currentQ.budgetChoices.length > 0 && (
                <div className="question-group-section">
                  <div className="question-section-label">Budget</div>
                  <div className="quick-replies">
                    {currentQ.budgetChoices.map(raw => {
                      const { value, label } = normalizeChoice(raw);
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`qr-btn${isBudgetSelected(value) ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`}
                          disabled={frozen}
                          onClick={() => setBudgetDraft(value)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {(currentQ.sections || []).some(section => TRIP_DETAILS_MORE_SECTION_IDS.has(section.id)) && (
                <div className="question-group-section question-group-collapsible question-more-options">
                  <button
                    type="button"
                    className="question-section-toggle question-more-options-toggle"
                    onClick={() => setMoreOptionsExpanded(prev => !prev)}
                    aria-expanded={moreOptionsExpanded}
                  >
                    <span className="question-section-label question-more-options-label">More options</span>
                    <span className="question-section-chevron" aria-hidden="true">{moreOptionsExpanded ? "−" : "+"}</span>
                  </button>
                  <div className={`question-collapsible-panel${moreOptionsExpanded ? " is-open" : ""}`}>
                    <div className="question-collapsible-inner">
                      {(currentQ.sections || [])
                        .filter(section => TRIP_DETAILS_MORE_SECTION_IDS.has(section.id))
                        .map(section => (
                          <div className="question-more-options-group" key={section.id}>
                            <div className="question-section-label">{section.label}</div>
                            <div className="quick-replies question-choices-scroll">
                              {(section.choices || []).map(raw => {
                                const { value, label } = normalizeChoice(raw);
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    className={mkGroupClass(section.id, value)}
                                    disabled={frozen}
                                    onClick={() => toggleGroupSection(section.id, value)}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {currentQ.type === "multiselect_group" && (
            <>
              {(currentQ.sections || []).map(section => (
                <div className="question-group-section" key={section.id}>
                  <div className="question-section-label">{section.label}</div>
                  <div className="quick-replies">
                    {(section.choices || []).map(c => (
                      <button
                        key={c}
                        type="button"
                        className={mkGroupClass(section.id, c)}
                        disabled={frozen}
                        onClick={() => toggleGroupSection(section.id, c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </>,
      )}

      {currentQ.type === "text" && (
        <div className="question-text-wrap">
          <input
            type="text"
            className="question-text-input"
            placeholder={currentQ.placeholder || "Type your answer…"}
            defaultValue={questionConfirmed ? (committed[currentQ.id] || "") : ""}
            disabled={frozen}
            onKeyDown={e => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                triggerPrimaryHaptic();
                pickInstant(e.currentTarget.value.trim());
              }
            }}
          />
          <div className={actionRowClass}>
            {currentQ.id === "food_allergies" && (
              <button
                type="button"
                className="convo-nav-btn"
                disabled={frozen}
                onClick={() => pickInstant("None specified")}
              >
                Skip
              </button>
            )}
            {currentQ.id === "schedule_drive_hours" && (
              <button
                type="button"
                className="convo-nav-btn"
                disabled={frozen}
                onClick={() => pickInstant("Any reasonable hours")}
              >
                Skip
              </button>
            )}
          </div>
        </div>
      )}
    </div>

      {currentQ.type === "vehicle" && (
        <div className={actionRowClass}>
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen || !vehicleDraft}
            onClick={continueWithHaptic(() => pickInstant(vehicleDraft))}
          >
            Continue
          </button>
        </div>
      )}

      {currentQ.type === "party_composition" && (
        <div className={actionRowClass}>
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen}
            onClick={continueWithHaptic(submitPartyComposition)}
          >
            Continue
          </button>
        </div>
      )}

      {currentQ.type === "multiselect" && (
        <div className={actionRowClass}>
          {currentQ.id === "multi_vehicles" && multiDraft.length === 0 && (
            <p className="question-inline-hint">Select at least one vehicle, or tap Back to choose a different trip type.</p>
          )}
          {currentQ.id === "kids_ages" && multiDraft.length === 0 && (
            <p className="question-inline-hint">Select at least one age band, or choose &ldquo;Not sure / prefer not to say&rdquo;.</p>
          )}
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={
              frozen
              || (currentQ.id === "multi_vehicles" && multiDraft.length === 0)
              || (currentQ.id === "kids_ages" && multiDraft.length === 0)
            }
            onClick={continueWithHaptic(() => pickInstant([...(Array.isArray(multiDraft) ? multiDraft : [])]))}
          >
            Continue
          </button>
          {currentQ.id !== "multi_vehicles" && currentQ.id !== "kids_ages" && (
            <button type="button" className="convo-nav-btn convo-nav-btn-skip" disabled={frozen} onClick={() => pickInstant([])}>Skip</button>
          )}
        </div>
      )}

      {isTripDetails && (
        <div className={actionRowClass}>
          <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={continueWithHaptic(submitTripDetails)}>
            Continue
          </button>
          <button type="button" className="convo-nav-btn convo-nav-btn-defaults" disabled={frozen} onClick={skipTripDetails}>
            Defaults are fine
          </button>
        </div>
      )}

      {currentQ.type === "multiselect_group" && (
        <div className={actionRowClass}>
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen}
            onClick={continueWithHaptic(() => pickInstant({
              dietary: Array.isArray(groupDraft?.dietary) ? groupDraft.dietary : [],
              stops_interests: Array.isArray(groupDraft?.stops_interests) ? groupDraft.stops_interests : [],
            }))}
          >
            Continue
          </button>
          <button type="button" className="convo-nav-btn" disabled={frozen} onClick={() => pickInstant({ dietary: [], stops_interests: [] })}>
            Nothing special
          </button>
        </div>
      )}

    </div>
  );
}
