/** Local-time sky phases for the hero mountain scene and auto theme. */

export const SKY_CHECK_MS = 90_000;

export const SKY_PHASES = {
  pre_dawn: "pre_dawn",
  sunrise: "sunrise",
  midday: "midday",
  golden_hour: "golden_hour",
  dusk: "dusk",
  night: "night",
};

/** App theme default: day before 7 PM local, night at/after 7 PM. */
export function computeAutoTheme(now = new Date()) {
  return now.getHours() >= 19 ? "night" : "day";
}

/** Toggle target; clears manual override when it matches the time-based default. */
export function resolveThemeToggle(currentTheme, autoTheme) {
  const next = currentTheme === "day" ? "night" : "day";
  return next === autoTheme ? null : next;
}

/** Sky phase for hero: real time, or locked to theme when user overrides appearance. */
export function resolveSkyPhase({ theme = "night", now = new Date(), themeLocked = false } = {}) {
  if (themeLocked) return theme === "day" ? SKY_PHASES.midday : SKY_PHASES.night;
  return getSkyPhase(now);
}

export function getSkyPhase(now = new Date()) {
  const h = now.getHours();
  if (h >= 21 || h < 0) return SKY_PHASES.night;
  if (h >= 19) return SKY_PHASES.dusk;
  if (h >= 16) return SKY_PHASES.golden_hour;
  if (h >= 7) return SKY_PHASES.midday;
  if (h >= 5) return SKY_PHASES.sunrise;
  return SKY_PHASES.pre_dawn;
}

/** Deterministic star field for night / pre-dawn skies. */
export function buildStarField(count = 48, seed = 42) {
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 42,
    r: 0.6 + rand() * 1.4,
    opacity: 0.25 + rand() * 0.55,
  }));
}
