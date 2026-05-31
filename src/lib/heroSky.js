/** Hero sky hour — live time, URL overrides, and test dial gating. */

/** Live sky refresh — 1s for smooth sun drift; minute tick when reduced motion. */
export const SKY_LIVE_TICK_MS = 1_000;

/** @deprecated Use SKY_LIVE_TICK_MS */
export const SKY_TICK_MS = SKY_LIVE_TICK_MS;

export function getLiveSkyHour(now = new Date()) {
  return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
}

export function parseSkyHourParam(search = "") {
  if (typeof search !== "string") return null;
  const raw = new URLSearchParams(search).get("skyHour");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(24, n));
}

/** Dev: dial on by default. Production: only with ?skyTest=1. Force off with ?skyTest=0. */
export function isSkyTestEnabled(search = "", dev = import.meta.env.DEV) {
  const params = new URLSearchParams(search);
  const flag = params.get("skyTest");
  if (flag === "1") return true;
  if (flag === "0") return false;
  return dev;
}

export function resolveHeroSkyHour({ liveHour, dialOverride, urlHour }) {
  if (urlHour != null) return urlHour;
  if (dialOverride != null) return dialOverride;
  return liveHour;
}
