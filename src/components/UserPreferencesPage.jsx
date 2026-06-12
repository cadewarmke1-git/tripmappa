import { useEffect, useState } from "react";
import {
  FUEL_TYPE_CHOICES,
  DIETARY_PREFERENCE_CHOICES,
  ACCESSIBILITY_CHOICES,
  STOPS_INTERESTS_BASE,
  TRIP_BUDGET_CHOICES,
} from "../lib/tripAccommodations.js";
import { SCHEDULE_RESTRICTION_CHOICES } from "../lib/scheduleRestrictions.js";
import { fetchPlanPreferences, savePlanPreferences } from "../lib/planPreferencesApi.js";
import { TRAVELER_COUNT_CHOICES, formatTravelersLabel } from "../lib/vehicles.js";

const VEHICLE_CHOICES = [
  "Car",
  "SUV",
  "RV",
  "Semi Truck",
  "Box Truck",
  "Motorcycle",
  "Multi-vehicle trip",
];

const LODGING_CHOICES = [
  "Hotel or motel",
  "Campground or RV park",
  "Airbnb or vacation rental",
  "No lodging needed",
];

const PARTY_CHOICES = TRAVELER_COUNT_CHOICES;

const SETUP_SECTIONS = [
  { id: "vehicle", label: "Vehicle type", key: "vehicle", choices: VEHICLE_CHOICES },
  { id: "fuel_type", label: "Fuel type", key: "fuel_type", choices: FUEL_TYPE_CHOICES },
  { id: "travelers", label: "Party size", key: "travelers", choices: PARTY_CHOICES },
  { id: "lodging", label: "Lodging preference", key: "lodging", choices: LODGING_CHOICES },
];

const PRIMARY_SECTIONS = [
  { id: "dietary", label: "Food", key: "dietary", choices: DIETARY_PREFERENCE_CHOICES, multi: true },
  { id: "trip_budget", label: "Budget", key: "trip_budget", choices: TRIP_BUDGET_CHOICES },
];

const MORE_OPTION_SECTIONS = [
  { id: "stops_interests", label: "Fun stops", key: "stops_interests", choices: STOPS_INTERESTS_BASE, multi: true },
  { id: "accessibility", label: "Accessibility", key: "accessibility", choices: ACCESSIBILITY_CHOICES, multi: true },
  { id: "schedule_restrictions", label: "Schedule", key: "schedule_restrictions", choices: SCHEDULE_RESTRICTION_CHOICES, multi: true },
];

function toggleInList(list, value) {
  if (!Array.isArray(list)) return [value];
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

function summarizeValue(section, prefs) {
  const value = prefs[section.key];
  if (section.multi) {
    if (!Array.isArray(value) || value.length === 0) return "None selected";
    if (value.length <= 2) return value.join(", ");
    return `${value.length} selected`;
  }
  if (section.key === "travelers") return formatTravelersLabel(value) || "Not set";
  return value || "Not set";
}

function summarizeMoreOptions(prefs) {
  const parts = MORE_OPTION_SECTIONS
    .map(section => summarizeValue(section, prefs))
    .filter(summary => summary !== "None selected" && summary !== "Not set");
  return parts.length ? parts.join(" · ") : "None selected";
}

export default function UserPreferencesPage({
  accessToken,
  onBack,
  onToast,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set(["vehicle"]));
  const [moreOptionsExpanded, setMoreOptionsExpanded] = useState(false);
  const [prefs, setPrefs] = useState({
    vehicle: "",
    fuel_type: "",
    travelers: "",
    lodging: "",
    stops_interests: [],
    accessibility: [],
    dietary: [],
    schedule_restrictions: [],
    trip_budget: "",
  });

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPlanPreferences(accessToken);
        if (!cancelled) {
          setPrefs(prev => ({
            ...prev,
            ...data,
            stops_interests: data.stops_interests || [],
            accessibility: data.accessibility || [],
            dietary: data.dietary || [],
            schedule_restrictions: data.schedule_restrictions || [],
          }));
        }
      } catch (err) {
        onToast?.(err.message || "Could not load preferences");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, onToast]);

  async function handleSave() {
    if (!accessToken) return;
    setSaving(true);
    try {
      const saved = await savePlanPreferences(accessToken, prefs);
      onSaved?.(saved);
      onToast?.("Preferences saved", true);
    } catch (err) {
      onToast?.(err.message || "Could not save preferences");
    } finally {
      setSaving(false);
    }
  }

  function setField(key, value) {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }

  function toggleSection(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderCollapsibleSection(section) {
    const isOpen = expanded.has(section.id);
    return (
      <section key={section.id} className="user-preferences-collapsible">
        <button
          type="button"
          className="user-preferences-collapsible-toggle"
          aria-expanded={isOpen}
          onClick={() => toggleSection(section.id)}
        >
          <span className="user-preferences-collapsible-heading">
            <span className="user-preferences-section-title">{section.label}</span>
            {!isOpen && (
              <span className="user-preferences-collapsible-summary">
                {summarizeValue(section, prefs)}
              </span>
            )}
          </span>
          <span className="user-preferences-collapsible-chevron" aria-hidden="true">
            {isOpen ? "−" : "+"}
          </span>
        </button>
        <div className={`user-preferences-collapsible-panel${isOpen ? " is-open" : ""}`}>
          <div className="user-preferences-collapsible-inner">
            <div className="user-preferences-collapsible-body">
              <ChoiceGrid
                choices={section.choices}
                selected={prefs[section.key]}
                multi={section.multi}
                onSelect={v => setField(section.key, v)}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="user-preferences-page">
      <div className="user-preferences-scroll">
        <header className="user-preferences-header">
          <button type="button" className="user-preferences-close" onClick={onBack}>
            ← Back
          </button>
          <h1 className="user-preferences-title">Trip preferences</h1>
          <p className="user-preferences-lead">
            Saved defaults pre-fill the planner so you can skip repeating the same answers.
          </p>
        </header>

        {loading ? (
          <p className="user-preferences-loading">Loading preferences…</p>
        ) : (
          <form
            className="user-preferences-form"
            onSubmit={e => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="user-preferences-sections">
              {SETUP_SECTIONS.map(renderCollapsibleSection)}

              {PRIMARY_SECTIONS.map(section => (
                <section key={section.id} className="user-preferences-primary">
                  <h2 className="user-preferences-section-title">{section.label}</h2>
                  <ChoiceGrid
                    choices={section.choices}
                    selected={prefs[section.key]}
                    multi={section.multi}
                    onSelect={v => setField(section.key, v)}
                  />
                </section>
              ))}

              <section className="user-preferences-collapsible user-preferences-more-options">
                <button
                  type="button"
                  className="user-preferences-collapsible-toggle user-preferences-more-options-toggle"
                  aria-expanded={moreOptionsExpanded}
                  onClick={() => setMoreOptionsExpanded(prev => !prev)}
                >
                  <span className="user-preferences-collapsible-heading">
                    <span className="user-preferences-section-title">More options</span>
                    {!moreOptionsExpanded && (
                      <span className="user-preferences-collapsible-summary">
                        {summarizeMoreOptions(prefs)}
                      </span>
                    )}
                  </span>
                  <span className="user-preferences-collapsible-chevron" aria-hidden="true">
                    {moreOptionsExpanded ? "−" : "+"}
                  </span>
                </button>
                <div className={`user-preferences-collapsible-panel${moreOptionsExpanded ? " is-open" : ""}`}>
                  <div className="user-preferences-collapsible-inner">
                    <div className="user-preferences-collapsible-body user-preferences-more-options-body">
                      {MORE_OPTION_SECTIONS.map(section => (
                        <div className="user-preferences-more-options-group" key={section.id}>
                          <h3 className="user-preferences-more-options-group-title">{section.label}</h3>
                          <ChoiceGrid
                            choices={section.choices}
                            selected={prefs[section.key]}
                            multi={section.multi}
                            onSelect={v => setField(section.key, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </form>
        )}
      </div>
      {!loading && (
        <div className="user-preferences-footer-sticky">
          <button
            type="button"
            className="btn-generate user-preferences-save"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      )}
    </div>
  );
}

function resolveChoice(choice) {
  if (choice && typeof choice === "object" && choice.value != null) {
    return { value: choice.value, label: choice.label ?? choice.value };
  }
  return { value: choice, label: choice };
}

function ChoiceGrid({ choices, selected, onSelect, multi = false }) {
  return (
    <div className="user-preferences-choices">
      {choices.map(choice => {
        const { value, label } = resolveChoice(choice);
        const active = multi
          ? Array.isArray(selected) && selected.includes(value)
          : selected === value;
        return (
          <button
            key={value}
            type="button"
            className={`user-preferences-choice${active ? " is-active" : ""}`}
            onClick={() => onSelect(multi ? toggleInList(selected, value) : value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
