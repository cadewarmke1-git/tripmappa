/** Silent background persistence after a successful logged-in trip generation. */
import { saveTrip } from "./tripsApi.js";
import { recordUserStopPreferences } from "./generationContext.js";
import {
  fetchPlanPreferencesFull,
  savePlanPreferencesFull,
} from "./planPreferencesApi.js";
import {
  extractWriteBackFields,
  mergePlanPreferencesFromGeneration,
} from "./planPreferencesWriteBack.js";

/**
 * Plan preference write-back runs via extractWriteBackFields → PLAN_PREF_WRITE_BACK_KEYS only.
 * stops_interests and kids_ages are excluded: interests change per trip; child ages should
 * only be updated when the user sets them on the preferences page, not inferred from each generation.
 */

/**
 * Save trip + refresh saved list + write back plan_preferences. Failures are logged only.
 */
export async function persistAfterSuccessfulGeneration({
  userId,
  accessToken,
  tripPayload,
  normalizedAnswers,
  onTripSaved,
  onPreferencesSaved,
}) {
  if (!userId || !accessToken) return;

  try {
    const saved = await saveTrip(userId, tripPayload);
    onTripSaved?.(saved);

    const userAddedStops = (tripPayload.roadStops || []).filter(s => s.userAdded);
    if (userAddedStops.length) {
      await recordUserStopPreferences(
        accessToken,
        userAddedStops,
        userAddedStops.length,
        { incrementTrip: true },
      );
    }
  } catch (err) {
    console.warn("post-generation trip save failed:", err);
  }

  return writeBackPlanPreferencesSilently(accessToken, normalizedAnswers, onPreferencesSaved);
}

/** Silent plan_preferences merge after generation or guest conversion — failures logged only. */
export async function writeBackPlanPreferencesSilently(accessToken, normalizedAnswers, onPreferencesSaved) {
  if (!accessToken || !normalizedAnswers) return null;

  try {
    const { preferences: currentPrefs, meta } = await fetchPlanPreferencesFull(accessToken);
    const generatedFields = extractWriteBackFields(normalizedAnswers);
    const { preferences, meta: nextMeta } = mergePlanPreferencesFromGeneration(
      currentPrefs,
      meta,
      generatedFields,
    );
    const saved = await savePlanPreferencesFull(accessToken, preferences, nextMeta);
    onPreferencesSaved?.(saved.preferences, saved.meta);
    return saved;
  } catch (err) {
    console.warn("plan preferences write-back failed:", err);
    return null;
  }
}
