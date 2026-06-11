/** Icon + display helpers for personal_touches in results UI. */

const TOUCH_ICON_RULES = [
  { id: "pet", re: /\b(pet|dog|puppy|cat|golden retriever|animal|paw)\b/i },
  { id: "family", re: /\b(kid|child|children|family|playground|toddler|young)\b/i },
  { id: "dietary", re: /\b(gluten|vegan|vegetarian|halal|kosher|dietary|allerg|seafood|food|bbq|dining|restaurant|lunch|dinner)\b/i },
  { id: "preference", re: /\b(scenic|history|past trip|usually|consistently|prefer|pattern|lodging|hotel)\b/i },
];

/** @returns {"pet"|"family"|"dietary"|"preference"|"default"} */
export function getPersonalTouchIconType(text) {
  const line = String(text || "");
  for (const rule of TOUCH_ICON_RULES) {
    if (rule.re.test(line)) return rule.id;
  }
  return "default";
}

/** @deprecated Use getPersonalTouchIconType — kept for tests migrating off emoji. */
export function getPersonalTouchIcon(text) {
  return getPersonalTouchIconType(text);
}

export function normalizePersonalTouches(touches) {
  if (!Array.isArray(touches)) return [];
  return touches.map(t => (typeof t === "string" ? t.trim() : "")).filter(Boolean).slice(0, 4);
}
