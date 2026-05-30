import { describe, it, expect } from "vitest";
import {
  buildScheduleAlerts,
  needsScheduleHoursDetail,
  SCHEDULE_SABBATH,
  SCHEDULE_SPECIFIC_HOURS,
} from "./scheduleRestrictions.js";

describe("scheduleRestrictions", () => {
  it("flags Sabbath overlap when trip spans Saturday", () => {
    const dep = new Date("2026-05-22T08:00:00"); // Friday
    const alerts = buildScheduleAlerts({
      answers: { schedule_restrictions: [SCHEDULE_SABBATH] },
      routeInfo: { duration: "20 hours" },
      departureTime: dep,
    });
    expect(alerts.some(a => a.title.includes("Saturday"))).toBe(true);
  });

  it("requires drive-hours detail when specific hours selected", () => {
    expect(needsScheduleHoursDetail({
      schedule_restrictions: [SCHEDULE_SPECIFIC_HOURS],
    })).toBe(true);
    expect(needsScheduleHoursDetail({
      schedule_restrictions: ["No restrictions"],
    })).toBe(false);
  });
});
