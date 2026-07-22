import {
  DRAFT_QUICK_CHOICES,
  resolveDraftQuickPartyId,
  resolveDraftQuickPaceId,
  resolveDraftQuickSpendId,
} from "../lib/tripFlow.js";
import { triggerPrimaryHaptic } from "../lib/haptic.js";

const PARTY_QUESTION = { id: "party_composition", type: "party_composition" };
const PACE_QUESTION = { id: "stop_frequency", type: "choice" };
const SPEND_QUESTION = { id: "luxury_level", type: "choice" };

/**
 * Draft-first plan surface: short summary, three one-tap choices, pinned Generate.
 */
export default function TripDraftPanel({
  currentQ,
  answers = {},
  routeInfo,
  frozen = false,
  onApplyTuneAnswer,
  onGenerateTrip,
  generateDisabled = false,
}) {
  const distance = routeInfo?.distance || null;
  const duration = routeInfo?.duration || null;
  const stopLabel = currentQ?.suggestedStopCount || "A few (2-3)";
  const routeReady = Boolean(distance || duration);
  const questions = Array.isArray(currentQ?.quickChoices) && currentQ.quickChoices.length
    ? currentQ.quickChoices
    : DRAFT_QUICK_CHOICES;

  const selected = {
    party: resolveDraftQuickPartyId(answers),
    pace: resolveDraftQuickPaceId(answers),
    spending: resolveDraftQuickSpendId(answers),
  };

  function pickParty(option) {
    if (frozen) return;
    triggerPrimaryHaptic();
    onApplyTuneAnswer?.(
      { id: "party", question: PARTY_QUESTION },
      { adults: option.adults, children: option.children },
    );
  }

  function pickPace(option) {
    if (frozen) return;
    triggerPrimaryHaptic();
    onApplyTuneAnswer?.(
      { id: "pace", question: PACE_QUESTION },
      option.stop_frequency,
    );
  }

  function pickSpend(option) {
    if (frozen) return;
    triggerPrimaryHaptic();
    onApplyTuneAnswer?.(
      { id: "spending", question: SPEND_QUESTION },
      option.luxury_level,
    );
  }

  function onPick(groupId, option) {
    if (groupId === "party") pickParty(option);
    else if (groupId === "pace") pickPace(option);
    else if (groupId === "spending") pickSpend(option);
  }

  return (
    <div className="trip-draft-panel">
      <div className="trip-draft-scroll">
        <div className="trip-draft-summary">
          <h2 className="trip-draft-title">
            {routeReady ? "Ready when you are" : "Mapping your route…"}
          </h2>
          <div className="trip-draft-stats" aria-live="polite">
            <div className="trip-draft-stat">
              <span className="trip-draft-stat-label">Distance</span>
              <span className="trip-draft-stat-value">{distance || "Calculating…"}</span>
            </div>
            <div className="trip-draft-stat">
              <span className="trip-draft-stat-label">Drive time</span>
              <span className="trip-draft-stat-value">{duration || "Calculating…"}</span>
            </div>
            <div className="trip-draft-stat">
              <span className="trip-draft-stat-label">Stops</span>
              <span className="trip-draft-stat-value">{stopLabel}</span>
            </div>
          </div>
          <p className="trip-draft-reassure">
            We&apos;ll plan a comfortable drive with a few good stops. Change anything below if you want.
          </p>
        </div>

        <div className="trip-draft-tune">
          <h3 className="trip-draft-tune-title">Want to adjust anything?</h3>
          <div className="trip-draft-quick-list">
            {questions.map(group => (
              <div key={group.id} className="trip-draft-quick-group">
                <p className="trip-draft-quick-ask">{group.ask}</p>
                <div className="trip-draft-quick-options" role="group" aria-label={group.ask}>
                  {group.options.map(option => {
                    const isSelected = selected[group.id] === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`trip-draft-quick-btn${isSelected ? " is-selected" : ""}`}
                        aria-pressed={isSelected}
                        disabled={frozen}
                        onClick={() => onPick(group.id, option)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="trip-draft-generate-wrap">
        <button
          type="button"
          className="btn-generate trip-draft-generate"
          disabled={frozen || generateDisabled}
          onClick={() => {
            triggerPrimaryHaptic();
            onGenerateTrip?.();
          }}
        >
          Generate My Trip
        </button>
      </div>
    </div>
  );
}
