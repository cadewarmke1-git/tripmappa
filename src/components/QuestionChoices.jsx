import { useEffect, useState } from "react";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
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

function buildGroupDraft(currentQ, prefDraft, answers) {
  const draft = isGroupDraft(prefDraft) ? { ...prefDraft } : {};
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
  prefDraft,
  questionHistoryLength,
  compact = false,
  showNavRow = true,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetPrefDraft,
  onSkipRoutePending,
  onRoutePendingTimeout,
}) {
  const [vehicleTab, setVehicleTab] = useState(0);
  const [lodgingDraft, setLodgingDraft] = useState(null);
  const [loyaltyDraft, setLoyaltyDraft] = useState(null);
  const [groupDraft, setGroupDraft] = useState(null);
  const [multiDraft, setMultiDraft] = useState([]);
  const [partyAdults, setPartyAdults] = useState(2);
  const [partyChildren, setPartyChildren] = useState(0);
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false);
  const [routePendingExpired, setRoutePendingExpired] = useState(false);

  useEffect(() => {
    setRoutePendingExpired(false);
    if (!currentQ?.pendingRoute) return undefined;
    const timer = setTimeout(() => {
      setRoutePendingExpired(true);
      onRoutePendingTimeout?.();
    }, ROUTE_PENDING_UNLOCK_MS);
    return () => clearTimeout(timer);
  }, [currentQ?.id, currentQ?.pendingRoute, onRoutePendingTimeout]);

  useEffect(() => {
    setVehicleTab(0);
    setLodgingDraft(null);
    setLoyaltyDraft(answers.loyalty_program || null);
  }, [currentQ?.id, answers.loyalty_program]);

  useEffect(() => {
    if (currentQ?.type === "trip_details" || currentQ?.type === "multiselect_group") {
      setGroupDraft(buildGroupDraft(currentQ, prefDraft, answers));
      if (currentQ?.type === "trip_details") {
        setMoreOptionsExpanded(false);
      }
      return;
    }
    setGroupDraft(null);
    if (currentQ?.type === "multiselect") {
      setMultiDraft(Array.isArray(prefDraft) ? [...prefDraft] : []);
      return;
    }
    if (currentQ?.type === "party_composition") {
      const draft = isGroupDraft(prefDraft) ? prefDraft : {};
      setPartyAdults(draft.adults ?? answers.adult_count ?? 2);
      setPartyChildren(draft.children ?? answers.child_count ?? 0);
      return;
    }
    setMultiDraft([]);
  }, [currentQ?.id, currentQ?.type, prefDraft, answers]);

  if (!currentQ?.id || !currentQ?.type) return null;

  const frozen = !!stepAnim;
  const selected = stepAnim?.answer;
  const choices = Array.isArray(currentQ.choices) ? currentQ.choices : [];
  const vehicleGroups = currentQ.type === "vehicle" && Array.isArray(currentQ.groups) ? currentQ.groups : null;
  const useVehicleTabs = compact && vehicleGroups;

  const mkClass = (val, extra = "") => {
    const sel = selected === val ? " qr-selected" : "";
    const active = answers[currentQ.id] === val || lodgingDraft === val ? " qr-selected" : "";
    return `qr-btn${extra}${sel || active}${frozen && selected !== val && answers[currentQ.id] !== val && lodgingDraft !== val ? " qr-dimmed" : ""}`;
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
    setGroupDraft(prev => {
      const base = prev ? { ...prev } : buildGroupDraft(currentQ, {}, answers);
      const section = Array.isArray(base[sectionId]) ? base[sectionId] : [];
      const next = {
        ...base,
        [sectionId]: section.includes(value)
          ? section.filter(x => x !== value)
          : [...section, value],
      };
      onSetPrefDraft(next);
      return next;
    });
  }

  function submitLodgingStay() {
    if (!lodgingDraft) return;
    pickInstant(lodgingDraft, { loyalty_program: loyaltyDraft || "No preference" });
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
    const draft = groupDraft || buildGroupDraft(currentQ, prefDraft, answers);
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
    setGroupDraft(prev => {
      const base = prev ? { ...prev } : buildGroupDraft(currentQ, {}, answers);
      const current = base.trip_budget || "No budget limit";
      const next = { ...base, trip_budget: current === value ? "No budget limit" : value };
      onSetPrefDraft(next);
      return next;
    });
  }

  function toggleMultiDraft(value) {
    setMultiDraft(prev => {
      const list = Array.isArray(prev) ? prev : [];
      const next = list.includes(value) ? list.filter(x => x !== value) : [...list, value];
      onSetPrefDraft(next);
      return next;
    });
  }

  function submitPartyComposition() {
    pickInstant({ adults: Number(partyAdults), children: Number(partyChildren) });
  }

  function adjustPartyCount(field, delta) {
    const [min, max] = field === "adults"
      ? (currentQ.adultRange || [1, 8])
      : (currentQ.childRange || [0, 6]);
    const setter = field === "adults" ? setPartyAdults : setPartyChildren;
    setter(prev => {
      const next = Math.min(max, Math.max(min, Number(prev) + delta));
      onSetPrefDraft({
        adults: field === "adults" ? next : partyAdults,
        children: field === "children" ? next : partyChildren,
      });
      return next;
    });
  }

  const scrollOptions = compact
    && currentQ.type !== "loading"
    && currentQ.type !== "text"
    && currentQ.type !== "trip_details"
    && currentQ.type !== "party_composition";

  function wrapScrollable(content) {
    if (!scrollOptions) return content;
    return <div className="question-options-scroll">{content}</div>;
  }

  return (
    <div className={`question-choices${frozen ? " choices-frozen" : ""}${compact ? " question-choices-compact" : ""}`}>
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
                    onClick={() => onPickAnswer(opt.value)}
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
                    onClick={() => onPickAnswer(opt.value)}
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
                <p className="question-pending-note">Route details are still loading — choices unlock in a moment.</p>
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
                    onClick={() => onPickAnswer(value)}
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
            </div>
          )}

          {isLodgingStay && (
            <>
              <div className="quick-replies quick-replies-lodging">
                {choices.map(raw => {
                  const { value, label } = normalizeChoice(raw);
                  return (
                    <button
                      key={value}
                      type="button"
                      className={mkClass(value, " qr-btn-lodging")}
                      disabled={frozen}
                      onClick={() => setLodgingDraft(value)}
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
              {[
                { field: "adults", label: "Adults", value: partyAdults, range: currentQ.adultRange || [1, 8] },
                { field: "children", label: "Children", value: partyChildren, range: currentQ.childRange || [0, 6] },
              ].map(({ field, label, value, range }) => (
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
                      disabled={frozen || value >= range[1]}
                      onClick={() => adjustPartyCount(field, 1)}
                      aria-label={`More ${label.toLowerCase()}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
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
                          className={`qr-btn${budgetDraft === value ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`}
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

      {isLodgingStay && (
        <div className="pref-actions-row">
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen || !lodgingDraft}
            onClick={continueWithHaptic(submitLodgingStay)}
          >
            Continue
          </button>
        </div>
      )}

      {currentQ.type === "party_composition" && (
        <div className="pref-actions-row">
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
        <div className="pref-actions-row">
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
            <button type="button" className="convo-nav-btn" disabled={frozen} onClick={() => pickInstant([])}>Skip</button>
          )}
        </div>
      )}

      {isTripDetails && (
        <div className="pref-actions-row">
          <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={continueWithHaptic(submitTripDetails)}>
            Continue
          </button>
          <button type="button" className="convo-nav-btn convo-nav-btn-defaults" disabled={frozen} onClick={skipTripDetails}>
            Defaults are fine
          </button>
        </div>
      )}

      {currentQ.type === "multiselect_group" && (
        <div className="pref-actions-row">
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

      {currentQ.type === "text" && (
        <div className="question-text-wrap">
          <input
            type="text"
            className="question-text-input"
            placeholder={currentQ.placeholder || "Type your answer…"}
            defaultValue={answers[currentQ.id] || ""}
            disabled={frozen}
            onKeyDown={e => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                triggerPrimaryHaptic();
                pickInstant(e.currentTarget.value.trim());
              }
            }}
          />
          <div className="pref-actions-row">
            <button
              type="button"
              className="btn-generate btn-generate-inline"
              disabled={frozen}
              onClick={continueWithHaptic(() => {
                const el = document.querySelector(".question-text-input");
                if (el?.value?.trim()) pickInstant(el.value.trim());
              })}
            >
              Continue
            </button>
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
  );
}
