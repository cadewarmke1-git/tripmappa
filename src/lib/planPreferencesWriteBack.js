/** Merge generation answers into saved plan_preferences without clobbering manual profile edits. */
import { asArray } from "./tripAccommodations.js";

/**
 * Fields written back after generation. Intentionally excludes:
 * - stops_interests: varies per trip; must not override saved preferences-page selections.
 * - kids_ages: changes as children grow; only set explicitly by the user on the preferences page.
 */
export const PLAN_PREF_WRITE_BACK_KEYS = [
  "vehicle",
  "fuel_type",
  "travelers",
  "dietary",
  "accessibility",
  "schedule_restrictions",
  "trip_budget",
  "lodging",
  "preferences",
];

export function extractWriteBackFields(answers = {}) {
  const out = {};
  if (answers.vehicle) out.vehicle = answers.vehicle;
  if (answers.fuel_type) out.fuel_type = answers.fuel_type;
  if (answers.travelers) out.travelers = answers.travelers;
  if (answers.trip_budget) out.trip_budget = answers.trip_budget;
  if (answers.lodging) out.lodging = answers.lodging;

  const dietary = asArray(answers.dietary).filter(d => d && d !== "No restrictions");
  if (dietary.length) out.dietary = dietary;

  const accessibility = asArray(answers.accessibility).filter(a => a && a !== "No special needs");
  if (accessibility.length) out.accessibility = accessibility;

  const schedule = asArray(answers.schedule_restrictions).filter(s => s && s !== "No restrictions");
  if (schedule.length) out.schedule_restrictions = schedule;

  const preferences = asArray(answers.preferences).filter(Boolean);
  if (preferences.length) out.preferences = preferences;

  return out;
}

function isEmptyPrefValue(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function stableJson(value) {
  return JSON.stringify(value);
}

/**
 * Write back when a field is empty or the new trip value differs from last_generated_preferences.
 * Preserves fields the user set manually on the preferences page (current !== last_generated, new === last_generated).
 */
export function mergePlanPreferencesFromGeneration(planPrefs = {}, meta = {}, generatedFields = {}) {
  const lastGen = meta.last_generated_preferences && typeof meta.last_generated_preferences === "object"
    ? meta.last_generated_preferences
    : {};
  const out = { ...planPrefs };

  for (const key of PLAN_PREF_WRITE_BACK_KEYS) {
    const value = generatedFields[key];
    if (value == null || (Array.isArray(value) && !value.length)) continue;

    const current = out[key];
    const lastVal = lastGen[key];
    const isEmpty = isEmptyPrefValue(current);
    const differsFromLast = stableJson(value) !== stableJson(lastVal);

    if (isEmpty || differsFromLast) {
      out[key] = Array.isArray(value) ? [...value] : value;
    }
  }

  const newLastGen = { ...lastGen };
  for (const key of PLAN_PREF_WRITE_BACK_KEYS) {
    if (generatedFields[key] != null) {
      newLastGen[key] = Array.isArray(generatedFields[key])
        ? [...generatedFields[key]]
        : generatedFields[key];
    }
  }

  const generation_count = (Number(meta.generation_count) || 0) + 1;

  return {
    preferences: out,
    meta: {
      last_generated_preferences: newLastGen,
      generation_count,
    },
  };
}
