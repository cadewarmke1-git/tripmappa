import { useMemo, useState } from "react";
import QuestionChoices from "./QuestionChoices.jsx";
import { formatSmartDefaultsSummary } from "../lib/tripFlow.js";
import { triggerPrimaryHaptic } from "../lib/haptic.js";

/**
 * Draft-first plan surface: route summary + optional tune sections + Generate.
 * Tune sections reuse the same question definitions as the sequential flow.
 */
export default function TripDraftPanel({
  currentQ,
  answers,
  committedAnswers,
  routeInfo,
  prefDraft,
  questionHistory = [],
  frozen = false,
  onSetPrefDraft,
  onApplyTuneAnswer,
  onGenerateTrip,
  generateDisabled = false,
}) {
  const [openSectionId, setOpenSectionId] = useState(
    currentQ?.openCustomize ? "party" : null,
  );
  const [reviewedIds, setReviewedIds] = useState(() => new Set());

  const distance = routeInfo?.distance || null;
  const duration = routeInfo?.duration || null;
  const stopLabel = currentQ?.suggestedStopCount || "A few (2-3)";
  const defaultsLine = formatSmartDefaultsSummary(answers);
  const sections = Array.isArray(currentQ?.tuneSections) ? currentQ.tuneSections : [];
  const reviewedCount = reviewedIds.size;
  const sectionTotal = sections.length;

  const routeReady = Boolean(distance || duration);

  const activeSection = useMemo(
    () => sections.find(s => s.id === openSectionId) || null,
    [sections, openSectionId],
  );

  function toggleSection(id) {
    setOpenSectionId(prev => (prev === id ? null : id));
  }

  function handleTuneContinue(value, extraFields, options) {
    const section = activeSection;
    if (!section) return;
    onApplyTuneAnswer?.(section, value, extraFields, options);
    setReviewedIds(prev => {
      const next = new Set(prev);
      next.add(section.id);
      return next;
    });
    setOpenSectionId(null);
  }

  return (
    <div className="trip-draft-panel">
      <div className="trip-draft-summary">
        <p className="trip-draft-eyebrow">Draft route</p>
        <h2 className="trip-draft-title">
          {routeReady ? "Here is your starting plan" : "Mapping your route…"}
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
            <span className="trip-draft-stat-label">Suggested stops</span>
            <span className="trip-draft-stat-value">{stopLabel}</span>
          </div>
        </div>
        <p className="trip-draft-defaults">{defaultsLine}</p>
      </div>

      <div className="trip-draft-tune">
        <div className="trip-draft-tune-header">
          <h3 className="trip-draft-tune-title">Tune your trip</h3>
          {sectionTotal > 0 && (
            <p className="trip-draft-tune-progress">
              {reviewedCount} of {sectionTotal} optional sections reviewed
            </p>
          )}
        </div>

        <div className="trip-draft-tune-list">
          {sections.map(section => {
            const open = openSectionId === section.id;
            const reviewed = reviewedIds.has(section.id);
            return (
              <div
                key={section.id}
                className={`trip-draft-tune-section${open ? " is-open" : ""}${reviewed ? " is-reviewed" : ""}`}
              >
                <button
                  type="button"
                  className="trip-draft-tune-toggle"
                  aria-expanded={open}
                  disabled={frozen}
                  onClick={() => toggleSection(section.id)}
                >
                  <span>{section.label}</span>
                  <span className="trip-draft-tune-chevron" aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                {open && section.question && (
                  <div className="trip-draft-tune-body">
                    <p className="trip-draft-tune-ask">{section.question.ask}</p>
                    {section.question.hint && (
                      <p className="trip-draft-tune-hint">{section.question.hint}</p>
                    )}
                    <QuestionChoices
                      currentQ={section.question}
                      answers={answers}
                      committedAnswers={committedAnswers}
                      prefDraft={prefDraft}
                      questionHistory={questionHistory}
                      questionHistoryLength={questionHistory.length}
                      compact
                      planFlowLayout="tall"
                      actionsInDock={false}
                      onPickAnswer={handleTuneContinue}
                      onSetPrefDraft={onSetPrefDraft}
                    />
                  </div>
                )}
              </div>
            );
          })}
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
