import { describe, expect, it } from "vitest";
import {
  formatCollaborationHints,
  listCollabResponders,
  voteTotalsByStop,
} from "../../src/lib/collaborationHints.js";
import { upsertVote, appendSuggestion } from "./collaborationStore.js";

describe("collaborationStore", () => {
  it("upserts votes per participant and stop", () => {
    let votes = [];
    votes = upsertVote(votes, { participantId: "a", stopKey: "stop-0", vote: 1, displayName: "Amy" });
    votes = upsertVote(votes, { participantId: "a", stopKey: "stop-0", vote: -1, displayName: "Amy" });
    expect(votes).toHaveLength(1);
    expect(votes[0].vote).toBe(-1);
  });

  it("appends suggestions", () => {
    const suggestions = appendSuggestion([], {
      participantId: "b",
      placeName: "Grand Canyon",
      displayName: "Bob",
    });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].placeName).toBe("Grand Canyon");
  });
});

describe("collaboration hints helpers", () => {
  it("lists unique responders", () => {
    const responders = listCollabResponders({
      votes: [{ participantId: "a", displayName: "Amy" }],
      suggestions: [{ participantId: "b", displayName: "Bob" }],
      preferences: [{ participantId: "a", displayName: "Amy" }],
    });
    expect(responders).toHaveLength(2);
  });

  it("totals votes per stop", () => {
    const totals = voteTotalsByStop(
      [
        { stopKey: "stop-0", vote: 1 },
        { stopKey: "stop-0", vote: -1 },
        { stopKey: "stop-1", vote: 1 },
      ],
      [{ name: "A" }, { city: "B" }],
    );
    expect(totals[0].up).toBe(1);
    expect(totals[0].down).toBe(1);
    expect(totals[1].up).toBe(1);
  });
});

describe("formatCollaborationHints", () => {
  it("builds regeneration block from votes and suggestions", () => {
    const block = formatCollaborationHints({
      preferences: [{ displayName: "Amy", dietary: "Vegetarian" }],
      suggestions: [{ id: "1", displayName: "Bob", placeName: "Sedona", stopIndex: 1 }],
      votes: [{ participantId: "a", stopKey: "stop-0", vote: 1 }],
    }, [{ name: "Flagstaff" }]);
    expect(block).toMatch(/GROUP COLLABORATION/);
    expect(block).toMatch(/Vegetarian/);
    expect(block).toMatch(/Sedona/);
    expect(block).toMatch(/Flagstaff/);
  });
});
