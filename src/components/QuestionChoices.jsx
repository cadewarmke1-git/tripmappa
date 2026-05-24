import {
  isTruckVehicle,
  isRvVehicle,
  hasFamilyKids,
  needsVehicleSpecs,
} from "../lib/vehicles.js";
import { KIDS_AGE_CHOICES, TRUCK_HEIGHTS, TRUCK_WEIGHTS, RV_HEIGHTS, RV_WEIGHTS } from "../lib/tripFlow.js";

export default function QuestionChoices({
  currentQ,
  convoLoading,
  stepAnim,
  answers,
  prefDraft,
  prefSkipReady,
  questionHistoryLength,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetAnswers,
  onSetPrefDraft,
}) {
  if (!currentQ || convoLoading) return null;
  const frozen = !!stepAnim;
  const selected = stepAnim?.answer;
  const mkClass = (val, extra = "") => {
    const sel = selected === val ? " qr-selected" : "";
    const active = answers[currentQ.id] === val || answers.vehicle === val || answers.travelers === val ? " qr-selected" : "";
    return `qr-btn${extra}${sel || active}${frozen && selected !== val && answers[currentQ.id] !== val ? " qr-dimmed" : ""}`;
  };
  const mkPrefClass = (p) => `qr-btn${prefDraft.includes(p) ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`;

  const truckSelected = isTruckVehicle(answers.vehicle);
  const rvSelected = isRvVehicle(answers.vehicle);
  const canConfirmVehicle = answers.vehicle && (
    (!truckSelected && !rvSelected)
    || (truckSelected && answers.truck_height && answers.truck_weight && answers.truck_hazmat)
    || (rvSelected && answers.rv_height && answers.rv_weight && answers.rv_towing)
  );
  const familySelected = hasFamilyKids(answers.travelers);

  return (
    <div className={`question-choices${frozen ? " choices-frozen" : ""}`}>
      <div className="convo-nav-row">
        {!frozen && (
          <button type="button" className="convo-nav-btn" onClick={onResetPlan}>Start over</button>
        )}
        {questionHistoryLength > 0 && !frozen && (
          <button type="button" className="convo-nav-btn" onClick={onGoBack}>← Back</button>
        )}
      </div>

      {currentQ.type === "choice" && (
        <div className="quick-replies">
          {currentQ.choices.map(c => (
            <button key={c} type="button" className={mkClass(c)} disabled={frozen} onClick={() => onPickAnswer(c)}>{c}</button>
          ))}
        </div>
      )}

      {currentQ.type === "vehicle" && (
        <>
          <div className="quick-replies">
            {currentQ.choices.map(c => (
              <button
                key={c}
                type="button"
                className={mkClass(c)}
                disabled={frozen}
                onClick={() => {
                  if (needsVehicleSpecs(c)) {
                    onSetAnswers(a => ({ ...a, vehicle: c }));
                  } else {
                    onPickAnswer(c);
                  }
                }}
              >
                {c}
              </button>
            ))}
          </div>
          {truckSelected && (
            <div className="truck-inline-row">
              <select className="truck-pill-select" value={answers.truck_height || ""} disabled={frozen}
                onChange={e => onSetAnswers(a => ({ ...a, truck_height: e.target.value }))}>
                <option value="">Height</option>
                {TRUCK_HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select className="truck-pill-select" value={answers.truck_weight || ""} disabled={frozen}
                onChange={e => onSetAnswers(a => ({ ...a, truck_weight: e.target.value }))}>
                <option value="">Weight</option>
                {TRUCK_WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <select className="truck-pill-select" value={answers.truck_hazmat || ""} disabled={frozen}
                onChange={e => onSetAnswers(a => ({ ...a, truck_hazmat: e.target.value }))}>
                <option value="">Hazmat</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          )}
          {rvSelected && (
            <div className="truck-inline-row">
              <select className="truck-pill-select" value={answers.rv_height || ""} disabled={frozen}
                onChange={e => onSetAnswers(a => ({ ...a, rv_height: e.target.value }))}>
                <option value="">Height</option>
                {RV_HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <select className="truck-pill-select" value={answers.rv_weight || ""} disabled={frozen}
                onChange={e => onSetAnswers(a => ({ ...a, rv_weight: e.target.value }))}>
                <option value="">Weight</option>
                {RV_WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <select className="truck-pill-select" value={answers.rv_towing || ""} disabled={frozen}
                onChange={e => onSetAnswers(a => ({ ...a, rv_towing: e.target.value }))}>
                <option value="">Towing</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          )}
          {(truckSelected || rvSelected) && canConfirmVehicle && !frozen && (
            <button type="button" className="btn-generate btn-generate-inline" style={{ marginTop: 12 }} onClick={() => onPickAnswer(answers.vehicle)}>
              Continue
            </button>
          )}
        </>
      )}

      {currentQ.type === "travelers" && (
        <>
          <div className="quick-replies">
            {currentQ.choices.map(c => (
              <button
                key={c}
                type="button"
                className={mkClass(c)}
                disabled={frozen}
                onClick={() => {
                  if (hasFamilyKids(c)) {
                    onSetAnswers(a => ({ ...a, travelers: c }));
                  } else {
                    onPickAnswer(c);
                  }
                }}
              >
                {c}
              </button>
            ))}
          </div>
          {familySelected && (
            <div className="inline-follow-row">
              <span className="inline-follow-label">Ages?</span>
              <div className="quick-replies inline-pills">
                {KIDS_AGE_CHOICES.map(a => (
                  <button
                    key={a}
                    type="button"
                    className={`qr-btn${answers.kids_ages === a ? " qr-selected" : ""}`}
                    disabled={frozen}
                    onClick={() => onPickAnswer("Family with kids", { kids_ages: a })}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {currentQ.type === "multiselect" && (
        <>
          <div className="quick-replies">
            {currentQ.choices.map(c => (
              <button
                key={c}
                type="button"
                className={mkPrefClass(c)}
                disabled={frozen}
                onClick={() => onSetPrefDraft(d => d.includes(c) ? d.filter(x => x !== c) : [...d, c])}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="pref-actions-row">
            <button type="button" className="btn-generate btn-generate-inline" disabled={frozen} onClick={() => onPickAnswer([...prefDraft])}>
              Continue
            </button>
            {prefSkipReady && (
              <button type="button" className="convo-nav-btn" disabled={frozen} onClick={() => onPickAnswer([])}>Skip</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
