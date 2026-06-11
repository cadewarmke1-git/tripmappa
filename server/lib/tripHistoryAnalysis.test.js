import { describe, expect, it } from "vitest";
import { buildTravelerDossier } from "./tripHistoryAnalysis.js";

describe("server tripHistoryAnalysis re-export", () => {
  it("exposes buildTravelerDossier from shared module", () => {
    const dossier = buildTravelerDossier([], {
      lodging: "Mid-Range",
      preferences: ["Pet friendly"],
      accessibility: ["Traveling with young children"],
      kids_ages: ["5"],
      travelers: "3 to 5",
    });
    expect(dossier).toContain("TRAVELER DOSSIER");
    expect(dossier).toMatch(/pet|family|child/i);
  });
});
