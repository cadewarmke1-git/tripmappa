import { useEffect, useState } from "react";

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

export default function QuestionChoices({
  currentQ,
  stepAnim,
  answers,
  prefDraft,
  prefSkipReady,
  questionHistoryLength,
  compact = false,
  showNavRow = true,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetPrefDraft,
}) {
  const [vehicleTab, setVehicleTab] = useState(0);
  const [lodgingDraft, setLodgingDraft] = useState(null);
  const [loyaltyDraft, setLoyaltyDraft] = useState(null);

  useEffect(() => {
    setVehicleTab(0);
    setLodgingDraft(null);
    setLoyaltyDraft(answers.loyalty_program || null);
  }, [currentQ?.id, answers.loyalty_program]);

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
    const draft = isGroupDraft(prefDraft) ? prefDraft : prefDraft;
    const active = Array.isArray(draft) ? draft.includes(p) : false;
    return `qr-btn${active ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`;
  };
  const mkGroupClass = (sectionId, value) => {
    const sectionDraft = isGroupDraft(prefDraft) ? (prefDraft[sectionId] || []) : [];
    return `qr-btn${sectionDraft.includes(value) ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`;
  };

  const isSingleSelect = currentQ.type === "choice" || currentQ.type === "travelers";
  const isLodgingStay = currentQ.type === "lodging_stay";
  const isTripDetails = currentQ.type === "trip_details";
  const routeLocked = Boolean(currentQ.pendingRoute);
  const budgetDraft = isGroupDraft(prefDraft) ? (prefDraft.trip_budget || "No budget limit") : "No budget limit";

  function pickInstant(value, extraFields) {
    onPickAnswer(value, extraFields, { instant: true });
  }

  const labeledVehicleGroups = vehicleGroups
    ? vehicleGroups.filter(g => Array.isArray(g.options) && g.options.length > 0)
    : [];
  const activeVehicleGroup = useVehicleTabs
    ? labeledVehicleGroups[Math.min(vehicleTab, labeledVehicleGroups.length - 1)]
    : null;

  function toggleGroupSection(sectionId, value) {
    onSetPrefDraft(prev => {
      const base = isGroupDraft(prev) ? { ...prev } : {};
      const section = Array.isArray(base[sectionId]) ? base[sectionId] : [];
      base[sectionId] = section.includes(value)
        ? section.filter(x => x !== value)
        : [...section, value];
      return base;
    });
  }

  function submitLodgingStay() {
    if (!lodgingDraft) return;
    pickInstant(lodgingDraft, { loyalty_program: loyaltyDraft || "No preference" });
  }

  function submitTripDetails() {
    const draft = isGroupDraft(prefDraft) ? prefDraft : {};
    pickInstant({
      dietary: Array.isArray(draft.dietary) ? draft.dietary : [],
      stops_interests: Array.isArray(draft.stops_interests) ? draft.stops_interests : [],
      accessibility: Array.isArray(draft.accessibility) ? draft.accessibility : [],
      trip_budget: draft.trip_budget || "No budget limit",
    });
  }

  function skipTripDetails() {
    pickInstant({
      dietary: [],
      stops_interests: [],
      accessibility: [],
      trip_budget: "No budget limit",
    });
  }

  function setBudgetDraft(value) {
    onSetPrefDraft(prev => ({ ...(isGroupDraft(prev) ? prev : {}), trip_budget: value }));
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
          <span className="question-loading-spinner" aria-hidden="true" />
          <span>Getting route details…</span>
        </div>
      )}

      {useVehicleTabs && (
        <>
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
          {activeVehicleGroup && (
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
        </>
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
        <div className="quick-replies quick-replies-described">
          {routeLocked && (
            <p className="question-pending-note">Route details are still loading — choices unlock in a moment.</p>
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
          <div className="pref-actions-row">
            <button
              type="button"
              className="btn-generate btn-generate-inline"
              disabled={frozen || !lodgingDraft}
              onClick={submitLodgingStay}
            >
              Continue
            </button>
          </div>
        </>
      )}

      {currentQ.type === "multiselect" && (
        <>
          <div className="quick-replies">
            {choices.map(c => (
              <button
                key={c}
                type="button"
                className={mkPrefClass(c)}
                disabled={frozen}
                onClick={() => onSetPrefDraft(d => {
                  const list = Array.isArray(d) ? d : [];
                  return list.includes(c) ? list.filter(x => x !== c) : [...list, c];
                })}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="pref-actions-row">
            <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={() => pickInstant([...(Array.isArray(prefDraft) ? prefDraft : [])])}>
              Continue
            </button>
            <button type="button" className="convo-nav-btn" disabled={frozen} onClick={() => pickInstant([])}>Skip</button>
          </div>
        </>
      )}

      {isTripDetails && (
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
          <div className="pref-actions-row">
            <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={submitTripDetails}>
              Continue
            </button>
            <button type="button" className="convo-nav-btn" disabled={frozen} onClick={skipTripDetails}>
              Defaults are fine
            </button>
          </div>
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
          <div className="pref-actions-row">
            <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={() => pickInstant({
              dietary: isGroupDraft(prefDraft) ? (prefDraft.dietary || []) : [],
              stops_interests: isGroupDraft(prefDraft) ? (prefDraft.stops_interests || []) : [],
            })}>
              Continue
            </button>
            <button type="button" className="convo-nav-btn" disabled={frozen} onClick={() => pickInstant({ dietary: [], stops_interests: [] })}>
              Nothing special
            </button>
          </div>
        </>
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
                pickInstant(e.currentTarget.value.trim());
              }
            }}
          />
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen}
            onClick={() => {
              const el = document.querySelector(".question-text-input");
              if (el?.value?.trim()) pickInstant(el.value.trim());
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
