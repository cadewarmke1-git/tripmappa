const HERO_SKY_LOCK = "heroSkyLock";

/** Hero sky dial / URL hour owns surface tokens while the landing page is mounted. */
export function lockHeroSurfaceTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset[HERO_SKY_LOCK] = "1";
  syncSurfaceTheme(theme);
}

export function unlockHeroSurfaceTheme() {
  if (typeof document === "undefined") return;
  delete document.documentElement.dataset[HERO_SKY_LOCK];
}

export function isHeroSurfaceThemeLocked() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset[HERO_SKY_LOCK] === "1";
}

/** Sync sky-cycle surface theme to <html> so body-level UI (e.g. Google .pac-container) inherits tokens. */
export function syncSurfaceTheme(theme) {
  if (typeof document === "undefined") return;
  const surface = theme === "day" ? "day" : "night";
  document.documentElement.dataset.surfaceTheme = surface;
}
