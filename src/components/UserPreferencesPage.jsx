import { useEffect, useState } from "react";
import {
  FUEL_TYPE_CHOICES,
  DIETARY_CHOICES,
  ACCESSIBILITY_CHOICES,
  STOPS_INTERESTS_BASE,
  TRIP_BUDGET_CHOICES,
} from "../lib/tripAccommodations.js";
import { fetchPlanPreferences, savePlanPreferences } from "../lib/planPreferencesApi.js";

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

const PARTY_CHOICES = ["1", "2", "3 to 5", "6 or more"];

function toggleInList(list, value) {
  if (!Array.isArray(list)) return [value];
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value];
}

export default function UserPreferencesPage({
  accessToken,
  onBack,
  onToast,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    vehicle: "",
    fuel_type: "",
    travelers: "",
    lodging: "",
    stops_interests: [],
    accessibility: [],
    dietary: [],
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

  return (
    <div className="user-preferences-page">
      <div className="user-preferences-header">
        <button type="button" className="profile-back-btn" onClick={onBack}>← Back to profile</button>
        <h1 className="user-preferences-title">Trip preferences</h1>
        <p className="user-preferences-lead">
          Saved defaults pre-fill the planner so you can skip repeating the same answers.
        </p>
      </div>

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
          <PreferenceSection label="Vehicle type">
            <ChoiceGrid
              choices={VEHICLE_CHOICES}
              selected={prefs.vehicle}
              onSelect={v => setField("vehicle", v)}
            />
          </PreferenceSection>

          <PreferenceSection label="Fuel type">
            <ChoiceGrid
              choices={FUEL_TYPE_CHOICES}
              selected={prefs.fuel_type}
              onSelect={v => setField("fuel_type", v)}
            />
          </PreferenceSection>

          <PreferenceSection label="Party size">
            <ChoiceGrid
              choices={PARTY_CHOICES}
              selected={prefs.travelers}
              onSelect={v => setField("travelers", v)}
            />
          </PreferenceSection>

          <PreferenceSection label="Lodging preference">
            <ChoiceGrid
              choices={LODGING_CHOICES}
              selected={prefs.lodging}
              onSelect={v => setField("lodging", v)}
            />
          </PreferenceSection>

          <PreferenceSection label="Interests along the route">
            <ChoiceGrid
              multi
              choices={STOPS_INTERESTS_BASE}
              selected={prefs.stops_interests}
              onSelect={v => setField("stops_interests", toggleInList(prefs.stops_interests, v))}
            />
          </PreferenceSection>

          <PreferenceSection label="Accessibility and medical">
            <ChoiceGrid
              multi
              choices={ACCESSIBILITY_CHOICES}
              selected={prefs.accessibility}
              onSelect={v => setField("accessibility", toggleInList(prefs.accessibility, v))}
            />
          </PreferenceSection>

          <PreferenceSection label="Dietary preferences">
            <ChoiceGrid
              multi
              choices={DIETARY_CHOICES}
              selected={prefs.dietary}
              onSelect={v => setField("dietary", toggleInList(prefs.dietary, v))}
            />
          </PreferenceSection>

          <PreferenceSection label="Budget range">
            <ChoiceGrid
              choices={TRIP_BUDGET_CHOICES}
              selected={prefs.trip_budget}
              onSelect={v => setField("trip_budget", v)}
            />
          </PreferenceSection>

          <button type="submit" className="btn-generate user-preferences-save" disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </form>
      )}
    </div>
  );
}

function PreferenceSection({ label, children }) {
  return (
    <section className="user-preferences-section">
      <h2 className="user-preferences-section-title">{label}</h2>
      {children}
    </section>
  );
}

function ChoiceGrid({ choices, selected, onSelect, multi = false }) {
  return (
    <div className="user-preferences-choices">
      {choices.map(choice => {
        const active = multi
          ? Array.isArray(selected) && selected.includes(choice)
          : selected === choice;
        return (
          <button
            key={choice}
            type="button"
            className={`user-preferences-choice${active ? " is-active" : ""}`}
            onClick={() => onSelect(choice)}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
