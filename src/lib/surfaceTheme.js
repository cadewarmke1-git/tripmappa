import {
  getHeroUiThemeFromHour,
  getLocalSkyHour,
  getSkyPhaseFromHour,
  SKY_PHASES,
} from "./skyTime.js";

const HERO_SKY_LOCK = "heroSkyLock";

function normalizeSurfaceTheme(theme) {
  if (theme === "day" || theme === "twilight") return theme;
  return "night";
}

/** Pure sky-cycle resolution for tests and SSR. */
export function resolveSkyCycleState({ now = new Date(), hour, theme, skyPhase, themeLocked = false, themeOverride = null } = {}) {
  const h = hour ?? getLocalSkyHour(now);
  let phase = skyPhase;
  let surface = normalizeSurfaceTheme(theme);
  if (themeLocked && themeOverride) {
    phase = themeOverride === "day" ? SKY_PHASES.midday : SKY_PHASES.night;
    surface = normalizeSurfaceTheme(themeOverride === "day" ? "day" : "night");
  } else if (!phase) {
    phase = getSkyPhaseFromHour(h);
  }
  if (!theme && !themeLocked) {
    surface = normalizeSurfaceTheme(getHeroUiThemeFromHour(h));
  }
  return { surfaceTheme: surface, skyPhase: phase };
}

/** Hero sky dial / URL hour owns surface tokens while the landing page is mounted. */
export function lockHeroSurfaceTheme(theme, { skyPhase, hour } = {}) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset[HERO_SKY_LOCK] = "1";
  syncSkyCycle({ theme, skyPhase, hour });
}

export function unlockHeroSurfaceTheme() {
  if (typeof document === "undefined") return;
  delete document.documentElement.dataset[HERO_SKY_LOCK];
}

export function isHeroSurfaceThemeLocked() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset[HERO_SKY_LOCK] === "1";
}

/** Sync sky phase + surface tokens to <html> (pac-container + global palette). */
export function syncSkyCycle({
  now = new Date(),
  hour,
  theme,
  skyPhase,
  themeLocked = false,
  themeOverride = null,
} = {}) {
  if (typeof document === "undefined") return;
  const { surfaceTheme, skyPhase: phase } = resolveSkyCycleState({
    now,
    hour,
    theme,
    skyPhase,
    themeLocked,
    themeOverride,
  });
  document.documentElement.dataset.surfaceTheme = surfaceTheme;
  document.documentElement.dataset.skyPhase = phase;
}

/** @deprecated Prefer syncSkyCycle — kept for callers that only pass day/night/twilight. */
export function syncSurfaceTheme(theme) {
  syncSkyCycle({ theme });
}
