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

export function normalizePersonalTouches(touches) {
  if (!Array.isArray(touches)) return [];
  const out = [];
  for (const t of touches) {
    const trimmed = typeof t === "string" ? t.trim() : "";
    if (trimmed) out.push(trimmed);
    if (out.length >= 4) break;
  }
  return out;
}

const HIGHLIGHT_FOOD_RE = /\b(food|dining|restaurant|lunch|dinner|breakfast|dietary|gluten|vegan|vegetarian|halal|kosher|allerg|bbq|meal|coffee|cafe)\b/i;
const HIGHLIGHT_FUEL_RE = /\b(fuel|gas|diesel|charging|ev|supercharger|truck stop|gas station|pilot|love'?s|pump)\b/i;
const HIGHLIGHT_ROUTE_RE = /\b(route|scenic|highway|detour|avoid|toll|interstate|mile|drive|overnight|lodging|stop|timing|pattern)\b/i;

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/** @returns {"route"|"fuel"|"food"} */
export function getPlannedHighlightIconType(text) {
  const line = String(text || "");
  if (HIGHLIGHT_FOOD_RE.test(line)) return "food";
  if (HIGHLIGHT_FUEL_RE.test(line)) return "fuel";
  if (HIGHLIGHT_ROUTE_RE.test(line)) return "route";
  return "route";
}

function highlightSpecificityScore(line) {
  let score = 0;
  if (/\d/.test(line)) score += 3;
  if (/\b[A-Z][a-z]{2,}\b/.test(line)) score += 2;
  if (/\b(your|based on|matched|picked|chose|selected|preferred|usual)\b/i.test(line)) score += 1;
  const words = countWords(line);
  if (words >= 6 && words <= 14) score += 2;
  if (words > 18) score -= 2;
  return score;
}

export function shortenPlannedHighlight(line, maxWords = 12) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return "";
  const sentence = trimmed.split(/[.!?]/)[0].trim() || trimmed;
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return sentence;
  return words.slice(0, maxWords).join(" ").replace(/[,;:]$/, "");
}

/**
 * Up to 3 concise highlights from personalization copy — most specific first.
 * @returns {{ text: string, iconType: "route"|"fuel"|"food" }[]}
 */
export function buildPlannedHighlights(touches, max = 3) {
  if (!Array.isArray(touches)) return [];
  const items = [];
  for (const t of touches) {
    const line = typeof t === "string" ? t.trim() : "";
    if (!line) continue;
    const text = shortenPlannedHighlight(line, 12);
    if (text) {
      items.push({
        text,
        iconType: getPlannedHighlightIconType(line),
        specificity: highlightSpecificityScore(line),
      });
    }
  }
  return items
    .toSorted((a, b) => b.specificity - a.specificity)
    .slice(0, max)
    .map(({ text, iconType }) => ({ text, iconType }));
}
