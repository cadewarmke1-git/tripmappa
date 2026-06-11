/** Warm the lazy generation overlay chunk before the user taps Generate. */

import { getFlowPhaseId } from "./tripFlow.js";

const LATE_QUESTION_IDS = new Set([
  "trip_details",
  "food_and_stops",
  "food_allergies",
  "schedule_drive_hours",
  "trip_budget",
  "trip_nights",
  "lodging",
  "accessibility",
  "coordination_needs",
]);

let preloadPromise = null;

export function shouldPreloadGenerationLoader({ convoComplete = false, currentQuestionId = null } = {}) {
  if (convoComplete) return true;
  if (!currentQuestionId) return false;
  if (getFlowPhaseId(currentQuestionId) === "details") return true;
  return LATE_QUESTION_IDS.has(currentQuestionId);
}

/** Idempotent dynamic import — shares the same chunk as LazyModals. */
export function preloadGenerationStreamOverlay() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!preloadPromise) {
    preloadPromise = import("../components/GenerationStreamOverlay.jsx").catch(err => {
      preloadPromise = null;
      throw err;
    });
  }
  return preloadPromise;
}
