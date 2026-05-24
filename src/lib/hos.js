export function computeHOSCompliance(hours) {
  if (!hours || hours <= 0) return null;
  const drivingDays = Math.max(1, Math.ceil(hours / 11));
  const mandatoryBreaks = Math.floor(hours / 8);
  const overnightStopsRequired = Math.max(0, drivingDays - 1);
  const exceedsDailyLimit = hours > 11;
  return {
    drivingDays,
    mandatoryBreaks,
    overnightStopsRequired,
    totalHours: hours,
    exceedsDailyLimit,
    forcedStopNote: exceedsDailyLimit && overnightStopsRequired === 0
      ? "This route exceeds the 11-hour daily driving limit. I've added a mandatory rest stop mid-route to keep you compliant."
      : null,
  };
}