/** Server re-exports — keep trip-history logic in sync with src/lib/tripHistoryAnalysis.js */
export {
  buildTravelerDossier,
  buildRecentTripsPreferencesRollup,
  buildUserPatternSummary,
  resolveTripsForContext,
} from "../../src/lib/tripHistoryAnalysis.js";
