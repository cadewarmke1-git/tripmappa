import { useEffect, useMemo, useState } from "react";
import PulsingWordmark from "./PulsingWordmark.jsx";
import PlanOptionCard from "./plan/PlanOptionCard.jsx";
import PlanVehicleIcon from "./plan/PlanVehicleIcon.jsx";
import QuestionRouteSetup from "./plan/QuestionRouteSetup.jsx";
import { triggerPrimaryHaptic } from "../lib/haptic.js";
import { isQuestionConfirmedInHistory } from "../lib/generationContext.js";
import { ROUTE_PENDING_UNLOCK_MS } from "../lib/tripFlow.js";
import {
  splitVehicleGroups,
  vehicleOptionDescription,
} from "../lib/planFlowDisplay.js";

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
      stars: choice.stars ?? null,
    };
  }
  return { value: choice, label: choice, description: null, stars: null };
}

function StarGlyphs({ count = 0 }) {
  return (
    <span className="plan-star-glyphs" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`plan-star-glyph${i < count ? " is-filled" : ""}`}>★</span>
      ))}
    </span>
  );
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

function vehicleDisplayLabel(label) {
  const dash = String(label || "").indexOf("—");
  if (dash > 0) return String(label).slice(0, dash).trim();
  return label;
}

function renderOptionGrid(children) {
  return <div className="plan-option-grid">{children}</div>;
}

function renderPlanOptionCard({
  value,
  label,
  description = null,
  selected: isSelected,
  onSelect,
  icon = null,
  disabled = false,
}) {
  return (
    <PlanOptionCard
      key={value}
      label={label}
      description={description}
      icon={icon}
      selected={isSelected}
      disabled={disabled}
      onSelect={onSelect}
    />
  );
}

function isTripDetailsDraftEmpty(draft) {
  const dietary = Array.isArray(draft.dietary) ? draft.dietary : [];
  const stops = Array.isArray(draft.stops_interests) ? draft.stops_interests : [];
  const accessibility = Array.isArray(draft.accessibility) ? draft.accessibility : [];
  const schedule = Array.isArray(draft.schedule_restrictions) ? draft.schedule_restrictions : [];
  const budget = draft.trip_budget || "No budget limit";
  return !dietary.length && !stops.length && !accessibility.length && !schedule.length && budget === "No budget limit";
}

function continueWithHaptic(handler) {
  return () => {
    triggerPrimaryHaptic();
    handler();
  };
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
  actionsInDock = false,
  onDockActionsChange,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetPrefDraft,
  onSkipRoutePending,
  onRoutePendingTimeout,
  isLoaded = false,
  routeSetupOrigin = "",
  routeSetupDest = "",
  routeSetupOriginRef,
  routeSetupDestRef,
  routeSetupOriginAcRef,
  routeSetupDestAcRef,
  routeSetupOriginError = "",
  routeSetupDestError = "",
  onRouteSetupOriginChange,
  onRouteSetupDestChange,
  onRouteSetupSwap,
  onRouteSetupContinue,
}) {
  const [loyaltyOverride, setLoyaltyOverride] = useState(null);
  const [groupOverride, setGroupOverride] = useState(null);
  const [multiOverride, setMultiOverride] = useState(null);
  const [partyOverride, setPartyOverride] = useState(null);
  const [moreOptionsExpandedQId, setMoreOptionsExpandedQId] = useState(null);
  const [vehicleTypesExpandedQId, setVehicleTypesExpandedQId] = useState(null);
  const [routeExpiredKey, setRouteExpiredKey] = useState(null);
  const [budgetTouchedQId, setBudgetTouchedQId] = useState(null);

  const partyMax = useMemo(
    () => parseTravelersBandMax(answers?.travelers),
    [answers?.travelers],
  );

  const committed = committedAnswers ?? answers;
  const questionConfirmed = useMemo(
    () => isQuestionConfirmedInHistory(currentQ?.id, questionHistory),
    [currentQ?.id, questionHistory],
  );

  const routePendingKey = currentQ?.pendingRoute ? `${currentQ.id}:${currentQ.pendingRoute}` : null;
  const routePendingExpired = routeExpiredKey === routePendingKey && routePendingKey != null;

  useEffect(() => {
    if (!currentQ?.pendingRoute) return undefined;
    const key = `${currentQ.id}:${currentQ.pendingRoute}`;
    const timer = setTimeout(() => {
      setRouteExpiredKey(key);
      onRoutePendingTimeout?.();
    }, ROUTE_PENDING_UNLOCK_MS);
    return () => clearTimeout(timer);
  }, [currentQ?.id, currentQ?.pendingRoute, onRoutePendingTimeout]);

  const vehicleDraft = questionConfirmed && currentQ?.type === "vehicle"
    ? (committed[currentQ.id] || null)
    : null;
  const lodgingDraft = null;

  const derivedLoyaltyDraft = questionConfirmed && currentQ?.type === "lodging_stay"
    ? (committed.loyalty_program || null)
    : null;
  const loyaltyDraft = loyaltyOverride?.qId === currentQ?.id
    ? loyaltyOverride.value
    : derivedLoyaltyDraft;

  const derivedParty = useMemo(() => {
    if (currentQ?.type !== "party_composition") return null;
    if (questionConfirmed) {
      return { adults: committed.adult_count ?? 1, children: committed.child_count ?? 0 };
    }
    return { adults: null, children: null };
  }, [currentQ?.type, questionConfirmed, committed.adult_count, committed.child_count]);
  const partyState = partyOverride?.qId === currentQ?.id ? partyOverride : derivedParty;
  const partyAdults = partyState?.adults ?? null;
  const partyChildren = partyState?.children ?? null;

  const derivedGroupDraft = useMemo(() => {
    if (currentQ?.type === "trip_details" || currentQ?.type === "multiselect_group") {
      return buildGroupDraft(currentQ, prefDraft, committed, { includePrefill: questionConfirmed });
    }
    return null;
  }, [currentQ, prefDraft, committed, questionConfirmed]);
  const groupDraft = groupOverride?.qId === currentQ?.id ? groupOverride.draft : derivedGroupDraft;

  const derivedMultiDraft = useMemo(() => {
    if (currentQ?.type !== "multiselect") return [];
    const fromAnswers = Array.isArray(committed[currentQ.id]) ? committed[currentQ.id] : [];
    if (questionConfirmed) return [...fromAnswers];
    if (fromAnswers.length > 0) return [...fromAnswers];
    if (Array.isArray(prefDraft) && prefDraft.length > 0) return [...prefDraft];
    return [];
  }, [currentQ?.type, currentQ?.id, prefDraft, committed, questionConfirmed]);
  const multiDraft = multiOverride?.qId === currentQ?.id ? multiOverride.value : derivedMultiDraft;

  const multiDraftSet = useMemo(
    () => new Set(Array.isArray(multiDraft) ? multiDraft : []),
    [multiDraft],
  );

  const groupDraftSets = useMemo(() => {
    if (!isGroupDraft(groupDraft)) return {};
    const sets = {};
    for (const [sectionId, values] of Object.entries(groupDraft)) {
      if (Array.isArray(values)) sets[sectionId] = new Set(values);
    }
    return sets;
  }, [groupDraft]);

  const moreOptionsExpanded = moreOptionsExpandedQId === currentQ?.id;
  const vehicleTypesExpanded = vehicleTypesExpandedQId === currentQ?.id;
  const budgetTouched = budgetTouchedQId === currentQ?.id;

  useEffect(() => {
    if (!actionsInDock || !onDockActionsChange) return undefined;

    if (!currentQ?.id || !currentQ?.type) {
      onDockActionsChange(null);
      return () => onDockActionsChange(null);
    }

    const frozen = !!stepAnim;
    const isTripDetails = currentQ.type === "trip_details";
    const routePending = Boolean(currentQ.pendingRoute);

    const pickInstant = (value, extraFields) => {
      onPickAnswer(value, extraFields, { instant: true });
    };

    const submitPartyComposition = () => {
      onPickAnswer(
        { adults: Number(partyAdults ?? 1), children: Number(partyChildren ?? 0) },
        {},
      );
    };

    const submitTripDetails = () => {
      const draft = groupDraft || buildGroupDraft(currentQ, prefDraft, committed, { includePrefill: questionConfirmed });
      const empty = isTripDetailsDraftEmpty(draft);
      pickInstant({
        dietary: Array.isArray(draft.dietary) ? draft.dietary : [],
        stops_interests: Array.isArray(draft.stops_interests) ? draft.stops_interests : [],
        accessibility: Array.isArray(draft.accessibility) ? draft.accessibility : [],
        schedule_restrictions: Array.isArray(draft.schedule_restrictions) ? draft.schedule_restrictions : [],
        trip_budget: draft.trip_budget || "No budget limit",
      }, { trip_details_defaults_confirmed: empty });
    };

    const skipTripDetails = () => {
      pickInstant({
        dietary: [],
        stops_interests: [],
        accessibility: [],
        schedule_restrictions: [],
        trip_budget: "No budget limit",
      }, { trip_details_defaults_confirmed: true });
    };

    const dock = {
      visible: true,
      showStartOver: !frozen && Boolean(onResetPlan),
      showBack: questionHistoryLength > 0 && !frozen,
      onBack: onGoBack,
      showContinue: false,
      showSkip: false,
    };

    if (currentQ.type === "vehicle") {
      dock.showContinue = false;
    } else if (currentQ.type === "route_setup") {
      dock.showContinue = true;
      dock.continueDisabled = frozen;
      dock.onContinue = continueWithHaptic(() => onRouteSetupContinue?.());
    } else if (currentQ.type === "party_composition") {
      dock.showContinue = true;
      dock.continueDisabled = frozen;
      dock.onContinue = continueWithHaptic(submitPartyComposition);
    } else if (currentQ.type === "multiselect") {
      dock.showContinue = true;
      dock.continueDisabled = frozen
        || (currentQ.id === "multi_vehicles" && multiDraft.length === 0)
        || (currentQ.id === "kids_ages" && multiDraft.length === 0);
      dock.onContinue = continueWithHaptic(() => pickInstant([...(Array.isArray(multiDraft) ? multiDraft : [])]));
      if (currentQ.id !== "multi_vehicles" && currentQ.id !== "kids_ages") {
        dock.showSkip = true;
        dock.onSkip = () => pickInstant([]);
      }
    } else if (isTripDetails) {
      dock.showContinue = true;
      dock.continueDisabled = frozen;
      dock.onContinue = continueWithHaptic(submitTripDetails);
      dock.showSkip = true;
      dock.skipLabel = "Defaults are fine";
      dock.onSkip = skipTripDetails;
    } else if (currentQ.type === "multiselect_group") {
      dock.showContinue = true;
      dock.continueDisabled = frozen;
      dock.onContinue = continueWithHaptic(() => pickInstant({
        dietary: Array.isArray(groupDraft?.dietary) ? groupDraft.dietary : [],
        stops_interests: Array.isArray(groupDraft?.stops_interests) ? groupDraft.stops_interests : [],
      }));
      dock.showSkip = true;
      dock.skipLabel = "Nothing special";
      dock.onSkip = () => pickInstant({ dietary: [], stops_interests: [] });
    } else if (currentQ.type === "text") {
      if (currentQ.id === "food_allergies" || currentQ.id === "schedule_drive_hours") {
        dock.showSkip = true;
        dock.onSkip = () => pickInstant(currentQ.id === "food_allergies" ? "None specified" : "Any reasonable hours");
      }
    } else if (routePending && onSkipRoutePending) {
      dock.showSkip = true;
      dock.skipLabel = "Skip for now";
      dock.onSkip = onSkipRoutePending;
    }

    onDockActionsChange(dock);
    return () => onDockActionsChange(null);
  }, [
    actionsInDock,
    onDockActionsChange,
    currentQ,
    currentQ?.id,
    currentQ?.type,
    currentQ?.pendingRoute,
    stepAnim,
    partyAdults,
    partyChildren,
    vehicleDraft,
    multiDraft,
    groupDraft,
    questionHistoryLength,
    questionConfirmed,
    prefDraft,
    committed,
    onGoBack,
    onResetPlan,
    onSkipRoutePending,
    onPickAnswer,
    onRouteSetupContinue,
  ]);

  if (!currentQ?.id || !currentQ?.type) return null;

  const frozen = !!stepAnim;
  const selected = stepAnim?.answer;
  const choices = Array.isArray(currentQ.choices) ? currentQ.choices : [];
  const vehicleGroups = currentQ.type === "vehicle" && Array.isArray(currentQ.groups) && currentQ.groups.length > 0
    ? currentQ.groups
    : null;

  const committedChoiceValue = questionConfirmed ? committed[currentQ.id] : undefined;

  function isChoiceSelected(val) {
    return selected === val
      || committedChoiceValue === val
      || vehicleDraft === val
      || lodgingDraft === val;
  }

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

  function toggleGroupSection(sectionId, value) {
    const base = groupDraft ?? buildGroupDraft(currentQ, prefDraft, committed, { includePrefill: questionConfirmed });
    const section = Array.isArray(base[sectionId]) ? base[sectionId] : [];
    const next = {
      ...base,
      [sectionId]: section.includes(value)
        ? section.filter(x => x !== value)
        : [...section, value],
    };
    setGroupOverride({ qId: currentQ.id, draft: next });
    onSetPrefDraft(next);
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
    setBudgetTouchedQId(currentQ.id);
    const base = groupDraft ?? buildGroupDraft(currentQ, {}, committed);
    const current = base.trip_budget || "No budget limit";
    const next = { ...base, trip_budget: current === value ? "No budget limit" : value };
    setGroupOverride({ qId: currentQ.id, draft: next });
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
    setMultiOverride({ qId: currentQ.id, value: next });
    onSetPrefDraft(next);
  }

  function adjustPartyCount(field, delta) {
    const adultsBase = partyAdults ?? 1;
    const childrenBase = partyChildren ?? 0;
    const [min, max] = field === "adults"
      ? (currentQ.adultRange || [1, 8])
      : (currentQ.childRange || [0, 6]);
    const currentTotal = Number(adultsBase) + Number(childrenBase);
    if (delta > 0 && partyMax != null && currentTotal >= partyMax) return;

    const nextAdults = field === "adults"
      ? Math.min(max, Math.max(min, Number(adultsBase) + delta))
      : adultsBase;
    const nextChildren = field === "children"
      ? Math.min(max, Math.max(min, Number(childrenBase) + delta))
      : childrenBase;
    if (partyMax != null && nextAdults + nextChildren > partyMax) return;

    setPartyOverride({ qId: currentQ.id, adults: nextAdults, children: nextChildren });
    onSetPrefDraft({ adults: nextAdults, children: nextChildren });
  }

  function submitPartyComposition() {
    onPickAnswer(
      { adults: Number(partyAdults ?? 1), children: Number(partyChildren ?? 0) },
      {},
    );
  }

  const scrollOptions = compact
    && planFlowLayout === "tall"
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
      {currentQ.type === "loading" && (
        <div className="question-loading" aria-live="polite">
          <PulsingWordmark size="lg" />
        </div>
      )}

      {currentQ.type === "route_setup" && (
        <QuestionRouteSetup
          isLoaded={isLoaded}
          origin={routeSetupOrigin}
          dest={routeSetupDest}
          originRef={routeSetupOriginRef}
          destRef={routeSetupDestRef}
          originAcRef={routeSetupOriginAcRef}
          destAcRef={routeSetupDestAcRef}
          originError={routeSetupOriginError}
          destError={routeSetupDestError}
          frozen={frozen}
          onOriginChange={onRouteSetupOriginChange}
          onDestChange={onRouteSetupDestChange}
          onSwap={onRouteSetupSwap}
        />
      )}

      {isTripDetails && currentQ.pageTitle && (
        <div className="question-page-header">
          <h2 className="question-page-title">{currentQ.pageTitle}</h2>
          {currentQ.pageSubtitle && (
            <p className="question-page-subtitle">{currentQ.pageSubtitle}</p>
          )}
        </div>
      )}

      {wrapScrollable(
        <>
          {vehicleGroups && (() => {
            const { primary, expanded } = splitVehicleGroups(vehicleGroups);
            const primaryOptions = primary.flatMap(group => group.options);
            const expandedOptions = expanded.flatMap(group => group.options);

            function renderVehicleOption(opt) {
              return renderPlanOptionCard({
                value: opt.value,
                label: vehicleDisplayLabel(opt.label),
                description: vehicleOptionDescription(opt.value, opt.label),
                selected: isChoiceSelected(opt.value),
                disabled: frozen,
                onSelect: () => pickWithAnim(opt.value),
                icon: <PlanVehicleIcon vehicle={opt.value} />,
              });
            }

            return (
              <>
                {renderOptionGrid(primaryOptions.map(renderVehicleOption))}
                {expandedOptions.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="plan-vehicle-types-expander"
                      aria-expanded={vehicleTypesExpanded}
                      disabled={frozen}
                      onClick={() => setVehicleTypesExpandedQId(vehicleTypesExpanded ? null : currentQ.id)}
                    >
                      {vehicleTypesExpanded ? "− Fewer vehicle types" : "+ More vehicle types"}
                    </button>
                    {vehicleTypesExpanded && renderOptionGrid(expandedOptions.map(renderVehicleOption))}
                  </>
                )}
              </>
            );
          })()}

          {!vehicleGroups && isSingleSelect && currentQ.display === "star_rating" && (
            <div className="plan-star-rating" role="listbox" aria-label={currentQ.ask}>
              {choices.map(raw => {
                const { value, label, description, stars } = normalizeChoice(raw);
                const selectedChoice = isChoiceSelected(value);
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={selectedChoice}
                    className={`plan-star-rating-option${selectedChoice ? " is-selected" : ""}`}
                    disabled={frozen || routeLocked}
                    onClick={() => pickWithAnim(value)}
                  >
                    <StarGlyphs count={Number(stars) || Number(value) || 0} />
                    <span className="plan-star-rating-copy">
                      <span className="plan-star-rating-label">{label}</span>
                      {description && <span className="plan-star-rating-detail">{description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!vehicleGroups && isSingleSelect && currentQ.display !== "star_rating" && (
            <>
              {routePending && routeLocked && (
                <p className="question-pending-note question-pending-note--loading">
                  <PulsingWordmark size="lg" />
                  <span>Calculating your route — choices unlock in a moment.</span>
                </p>
              )}
              {routePending && routePendingExpired && (
                <p className="question-pending-note">Route details are still loading — your answer will be used as-is.</p>
              )}
              {renderOptionGrid(choices.map(raw => {
                const { value, label, description } = normalizeChoice(raw);
                return renderPlanOptionCard({
                  value,
                  label,
                  description,
                  selected: isChoiceSelected(value),
                  disabled: frozen || routeLocked,
                  onSelect: () => pickWithAnim(value),
                });
              }))}
              {routePending && onSkipRoutePending && !actionsInDock && (
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
            </>
          )}

          {isLodgingStay && (
            <>
              {currentQ.ask && (
                <p className="question-lodging-ask">{currentQ.ask}</p>
              )}
              {renderOptionGrid(choices.map(raw => {
                const { value, label } = normalizeChoice(raw);
                return renderPlanOptionCard({
                  value,
                  label,
                  selected: isChoiceSelected(value),
                  disabled: frozen,
                  onSelect: () => pickInstant(value, { loyalty_program: loyaltyDraft || "No preference" }),
                });
              }))}
              {Array.isArray(currentQ.loyaltyChoices) && currentQ.loyaltyChoices.length > 0 && (
                <div className="lodging-loyalty-section">
                  <div className="question-section-label">Hotel loyalty (optional)</div>
                  {renderOptionGrid(currentQ.loyaltyChoices.map(raw => {
                    const { value, label } = normalizeChoice(raw);
                    return renderPlanOptionCard({
                      value,
                      label,
                      selected: loyaltyDraft === value,
                      disabled: frozen,
                      onSelect: () => setLoyaltyOverride({ qId: currentQ.id, value }),
                    });
                  }))}
                </div>
              )}
            </>
          )}

          {currentQ.type === "multiselect" && (
            renderOptionGrid(choices.map(c => renderPlanOptionCard({
              value: c,
              label: c,
              selected: multiDraftSet.has(c),
              disabled: frozen,
              onSelect: () => toggleMultiDraft(c),
            })))
          )}

          {currentQ.type === "party_composition" && (
            <div className="party-composition-inputs">
              {partyMax != null && (
                <p className="party-composition-total" aria-live="polite" aria-atomic="true">
                  Total: {Number(partyAdults ?? 1) + Number(partyChildren ?? 0)} / {partyMax}
                </p>
              )}
              {[
                { field: "adults", label: "Adults", value: partyAdults ?? 1, range: currentQ.adultRange || [1, 8] },
                { field: "children", label: "Children", value: partyChildren ?? 0, range: currentQ.childRange || [0, 6] },
              ].map(({ field, label, value, range }) => {
                const atPartyMax = partyMax != null
                  && Number(partyAdults ?? 1) + Number(partyChildren ?? 0) >= partyMax;
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
                      <span className="party-composition-value" aria-live="polite" aria-atomic="true">{value}</span>
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
              {(currentQ.sections || []).flatMap(section => {
                if (section.id !== "dietary") return [];
                return [(
                  <div className="question-group-section" key={section.id}>
                    <div className="question-section-label">{section.label}</div>
                    {renderOptionGrid((section.choices || []).map(raw => {
                      const { value, label } = normalizeChoice(raw);
                      return renderPlanOptionCard({
                        value: `${section.id}:${value}`,
                        label,
                        selected: groupDraftSets[section.id]?.has(value) ?? false,
                        disabled: frozen,
                        onSelect: () => toggleGroupSection(section.id, value),
                      });
                    }))}
                  </div>
                )];
              })}
              {Array.isArray(currentQ.budgetChoices) && currentQ.budgetChoices.length > 0 && (
                <div className="question-group-section">
                  <div className="question-section-label">Budget</div>
                  {renderOptionGrid(currentQ.budgetChoices.map(raw => {
                    const { value, label } = normalizeChoice(raw);
                    return renderPlanOptionCard({
                      value: `budget:${value}`,
                      label,
                      selected: isBudgetSelected(value),
                      disabled: frozen,
                      onSelect: () => setBudgetDraft(value),
                    });
                  }))}
                </div>
              )}
              {(currentQ.sections || []).some(section => TRIP_DETAILS_MORE_SECTION_IDS.has(section.id)) && (
                <div className="question-group-section question-group-collapsible question-more-options">
                  <button
                    type="button"
                    className="question-section-toggle question-more-options-toggle"
                    onClick={() => setMoreOptionsExpandedQId(moreOptionsExpanded ? null : currentQ.id)}
                    aria-expanded={moreOptionsExpanded}
                  >
                    <span className="question-section-label question-more-options-label">More options</span>
                    <span className="question-section-chevron" aria-hidden="true">{moreOptionsExpanded ? "−" : "+"}</span>
                  </button>
                  <div className={`question-collapsible-panel${moreOptionsExpanded ? " is-open" : ""}`}>
                    <div className="question-collapsible-inner">
                      {(currentQ.sections || []).flatMap(section => {
                        if (!TRIP_DETAILS_MORE_SECTION_IDS.has(section.id)) return [];
                        return [(
                          <div className="question-more-options-group" key={section.id}>
                            <div className="question-section-label">{section.label}</div>
                            {renderOptionGrid((section.choices || []).map(raw => {
                              const { value, label } = normalizeChoice(raw);
                              return renderPlanOptionCard({
                                value: `${section.id}:${value}`,
                                label,
                                selected: groupDraftSets[section.id]?.has(value) ?? false,
                                disabled: frozen,
                                onSelect: () => toggleGroupSection(section.id, value),
                              });
                            }))}
                          </div>
                        )];
                      })}
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
                  {renderOptionGrid((section.choices || []).map(c => renderPlanOptionCard({
                    value: `${section.id}:${c}`,
                    label: c,
                    selected: groupDraftSets[section.id]?.has(c) ?? false,
                    disabled: frozen,
                    onSelect: () => toggleGroupSection(section.id, c),
                  })))}
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
          {!actionsInDock && (
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
          )}
        </div>
      )}
    </div>

      {!actionsInDock && currentQ.type === "route_setup" && (
        <div className={actionRowClass}>
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen}
            onClick={continueWithHaptic(() => onRouteSetupContinue?.())}
          >
            Continue
          </button>
        </div>
      )}

      {!actionsInDock && currentQ.type === "party_composition" && (
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

      {!actionsInDock && currentQ.type === "multiselect" && (
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

      {!actionsInDock && isTripDetails && (
        <div className={actionRowClass}>
          <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={continueWithHaptic(submitTripDetails)}>
            Continue
          </button>
          <button type="button" className="convo-nav-btn convo-nav-btn-defaults" disabled={frozen} onClick={skipTripDetails}>
            Defaults are fine
          </button>
        </div>
      )}

      {!actionsInDock && currentQ.type === "multiselect_group" && (
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
