import { describe, expect, it } from "vitest";
import { buildTravelerDossier } from "./tripHistoryAnalysis.js";

function makeTrip(answers = {}) {
  return {
    origin: "Dallas, TX",
    dest: "Asheville, NC",
    answers: {
      vehicle: "SUV or Van",
      lodging: "Mid-Range",
      preferences: ["Pet friendly", "Scenic route"],
      travelers: "3 to 5",
      kids_ages: ["6", "9"],
      accessibility: ["Traveling with young children"],
      stops_interests: ["National Parks or Nature"],
      dietary: ["No restrictions"],
      ...answers,
    },
  };
}

describe("buildTravelerDossier", () => {
  it("builds a warm narrative for family + pet + scenic history", () => {
    const history = [
      makeTrip(),
      makeTrip(),
      makeTrip({ dietary: ["Vegetarian"] }),
      makeTrip(),
    ];
    const dossier = buildTravelerDossier(history, makeTrip().answers);

    expect(dossier).toContain("TRAVELER DOSSIER");
    expect(dossier).toMatch(/family|kids|6 and 9/i);
    expect(dossier).toMatch(/pet/i);
    expect(dossier).toMatch(/scenic/i);
    expect(dossier).toMatch(/mid-range lodging/i);
  });

  it("returns empty when no signals exist", () => {
    expect(buildTravelerDossier([], { vehicle: "Car", travelers: "2" })).toBe("");
  });
});
