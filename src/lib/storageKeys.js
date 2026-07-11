/** Bump when stored JSON shape changes so old data can be ignored or migrated. */
export const LOCAL_STORAGE_VERSION = "v1";

export const SAVED_TRIPS_KEY = `tripmappa-saved:${LOCAL_STORAGE_VERSION}`;
export const PLAN_DRAFT_KEY = `tripmappa-plan-draft:${LOCAL_STORAGE_VERSION}`;
export const SAVED_LODGING_KEY = `tripmappa-saved-lodging:${LOCAL_STORAGE_VERSION}`;

const LEGACY_KEYS = {
  [SAVED_TRIPS_KEY]: "tripmappa-saved",
  [PLAN_DRAFT_KEY]: "tripmappa-plan-draft",
  [SAVED_LODGING_KEY]: "tripmappa-saved-lodging",
};

function migrateFromLegacy(key) {
  const legacyKey = LEGACY_KEYS[key];
  if (!legacyKey) return null;
  try {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy == null) return null;
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}

export function readLocalStorage(key) {
  try {
    return localStorage.getItem(key) ?? migrateFromLegacy(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

export function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    const legacyKey = LEGACY_KEYS[key];
    if (legacyKey) localStorage.removeItem(legacyKey);
  } catch {
    /* ignore */
  }
}
