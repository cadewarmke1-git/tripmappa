function normalizeChoice(choice) {
  if (choice && typeof choice === "object" && choice.value != null) {
    return { value: choice.value, label: choice.label ?? choice.value };
  }
  return { value: choice, label: choice };
}

export default function QuestionChoices({
  currentQ,
  stepAnim,
  answers,
  prefDraft,
  prefSkipReady,
  questionHistoryLength,
  compact = false,
  onResetPlan,
  onGoBack,
  onPickAnswer,
  onSetPrefDraft,
  onSetAnswers,
}) {
  if (!currentQ) return null;
  const frozen = !!stepAnim;
  const selected = stepAnim?.answer;
  const choices = Array.isArray(currentQ.choices) ? currentQ.choices : [];
  const vehicleGroups = currentQ.type === "vehicle" && Array.isArray(currentQ.groups) ? currentQ.groups : null;

  const mkClass = (val, extra = "") => {
    const sel = selected === val ? " qr-selected" : "";
    const active = answers[currentQ.id] === val ? " qr-selected" : "";
    return `qr-btn${extra}${sel || active}${frozen && selected !== val && answers[currentQ.id] !== val ? " qr-dimmed" : ""}`;
  };
  const mkPrefClass = (p) => `qr-btn${prefDraft.includes(p) ? " qr-selected" : ""}${frozen ? " qr-dimmed" : ""}`;

  const isSingleSelect = currentQ.type === "choice" || currentQ.type === "travelers" || currentQ.type === "lodging";
  const isLodging = currentQ.type === "lodging";

  return (
    <div className={`question-choices${frozen ? " choices-frozen" : ""}${compact ? " question-choices-compact" : ""}`}>
      <div className="convo-nav-row">
        {!frozen && (
          <button type="button" className="convo-nav-btn" onClick={onResetPlan}>Start over</button>
        )}
        {questionHistoryLength > 0 && !frozen && (
          <button type="button" className="convo-nav-btn" onClick={onGoBack}>← Back</button>
        )}
      </div>

      {vehicleGroups && vehicleGroups.map(group => (
        <div key={group.label} className="vehicle-group">
          <div className="vehicle-group-label">{group.label}</div>
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
        <div className={`quick-replies${isLodging ? " quick-replies-lodging" : ""}`}>
          {choices.map(raw => {
            const { value, label } = normalizeChoice(raw);
            return (
              <button
                key={value}
                type="button"
                className={mkClass(value, isLodging ? " qr-btn-lodging" : "")}
                disabled={frozen}
                onClick={() => onPickAnswer(value)}
              >
                {label}
              </button>
            );
          })}
        </div>
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
                onPickAnswer(e.currentTarget.value.trim());
              }
            }}
          />
          <button
            type="button"
            className="btn-generate btn-generate-inline"
            disabled={frozen}
            onClick={() => {
              const el = document.querySelector(".question-text-input");
              if (el?.value?.trim()) onPickAnswer(el.value.trim());
            }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
