import { describe, expect, it } from "vitest";
import {
  buildGenerationStreamProgress,
  buildClientCreditSnapshot,
  decrementCachedCreditStatus,
  readPlanTripSseStream,
} from "./planTripStream.js";

function encodeSse(events) {
  return events.map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

function mockSseResponse(events) {
  const body = encodeSse(events);
  let sent = false;
  return {
    body: {
      getReader() {
        return {
          read() {
            if (sent) return Promise.resolve({ done: true, value: undefined });
            sent = true;
            return Promise.resolve({ done: false, value: new TextEncoder().encode(body) });
          },
          cancel() {
            return Promise.resolve();
          },
        };
      },
    },
  };
}

describe("planTripStream client helpers", () => {
  it("extracts route summary and stop names from partial JSON", () => {
    const progress = buildGenerationStreamProgress(
      '{"route_summary":"Dallas to Austin day trip","road_stops":[{"name":"Buc-ee\'s","city":"Temple, TX"}]}',
    );
    expect(progress.phase).toBe("stops");
    expect(progress.routeSummary).toContain("Dallas");
    expect(progress.stopNames).toContain("Buc-ee's");
    expect(progress.cityNames).toContain("Temple, TX");
    expect(progress.message).toMatch(/Buc-ee/i);
  });

  it("builds client credit snapshot from status", () => {
    const snap = buildClientCreditSnapshot({
      tier: "voyager",
      remaining: 12,
      unlimited: false,
      billingPeriod: "monthly",
      resetDate: "2099-02-01",
      used: 8,
      limit: 20,
      monthlyUsed: 8,
    });
    expect(snap.monthly_generation_count).toBe(8);
    expect(snap.monthly_generation_reset_date).toBe("2099-02-01");
  });

  it("decrements cached monthly credits optimistically", () => {
    const next = decrementCachedCreditStatus({
      tier: "voyager",
      remaining: 3,
      used: 17,
      unlimited: false,
      billingPeriod: "monthly",
      monthlyUsed: 17,
    });
    expect(next.remaining).toBe(2);
    expect(next.monthlyUsed).toBe(18);
  });

  it("reads plan-trip SSE stream through complete event", async () => {
    const progressEvents = [];
    const payload = await readPlanTripSseStream(
      mockSseResponse([
        { event: "start", data: { maxTokens: 4096, tier: "short" } },
        { event: "chunk", data: { text: '{"stops":[{"city":"Waco, TX","name":"Waco"}]}' } },
        { event: "progress", data: { phase: "stops", cityNames: ["Waco, TX"] } },
        { event: "complete", data: { stops: [{ city: "Waco, TX", name: "Waco" }], road_stops: [] } },
      ]),
      undefined,
      (progress) => progressEvents.push(progress),
    );

    expect(payload.stops).toHaveLength(1);
    expect(progressEvents.some((event) => event.cityNames?.includes("Waco, TX"))).toBe(true);
  });

  it("throws when SSE stream ends with error event", async () => {
    await expect(readPlanTripSseStream(
      mockSseResponse([
        { event: "start", data: { maxTokens: 4096 } },
        { event: "chunk", data: { text: '{"route_summary":"Dallas to Austin"}' } },
        { event: "error", data: { error: "No Trip Generations remaining", code: "no_credits" } },
      ]),
    )).rejects.toMatchObject({ code: "no_credits" });
  });
});
