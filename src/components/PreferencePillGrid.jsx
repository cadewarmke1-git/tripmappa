function resolveOption(option) {
  if (option && typeof option === "object" && option.value != null) {
    return { value: option.value, label: option.label ?? option.value };
  }
  return { value: option, label: option };
}

export function togglePreferenceValue(list, value) {
  const next = Array.isArray(list) ? [...list] : [];
  const idx = next.indexOf(value);
  if (idx >= 0) next.splice(idx, 1);
  else next.push(value);
  return next;
}

export default function PreferencePillGrid({
  options,
  selected = [],
  onToggle,
  className = "",
}) {
  const selectedSet = new Set(Array.isArray(selected) ? selected : []);
  return (
    <div className={`preference-pill-grid preference-choice-list${className ? ` ${className}` : ""}`}>
      {options.map(raw => {
        const { value, label } = resolveOption(raw);
        const active = selectedSet.has(value);
        return (
          <button
            key={value}
            type="button"
            className={`plan-choice-row qr-btn preference-pill${active ? " is-selected qr-selected" : ""}`}
            onClick={() => onToggle(value)}
          >
            <span className="plan-choice-row-label">
              <span className="qr-btn-label">{label}</span>
            </span>
            <span className="plan-choice-row-chevron" aria-hidden="true">{active ? "✓" : "›"}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PreferencePillGroups({
  groups,
  selected = [],
  onToggle,
  className = "",
}) {
  return (
    <div className={`preference-pill-groups${className ? ` ${className}` : ""}`}>
      {groups.map(group => (
        <section key={group.id} className="preference-pill-group">
          {group.label && (
            <h3 className="preference-pill-group-label">{group.label}</h3>
          )}
          <PreferencePillGrid
            options={group.options}
            selected={selected}
            onToggle={onToggle}
          />
        </section>
      ))}
    </div>
  );
}
