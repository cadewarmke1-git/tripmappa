/** Structured trip tips — normalize, split, and format for UI / regeneration hints. */
import { sanitizeHintText } from "./hintSanitization.js";

const SEVERITIES = new Set(["info", "advisory", "action"]);
const ACTION_TYPES = new Set(["reroute", "depart_earlier"]);

function coerceString(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function normalizeTripTip(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    return { severity: "info", title: text, detail: "", action: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const severity = SEVERITIES.has(raw.severity) ? raw.severity : "info";
  const title = coerceString(raw.title || raw.message);
  const detail = coerceString(raw.detail || (raw.title && raw.message && raw.message !== raw.title ? raw.message : ""));
  if (!title && !detail) return null;

  let action = null;
  if (severity === "action" && raw.action && typeof raw.action === "object") {
    const type = ACTION_TYPES.has(raw.action.type) ? raw.action.type : "reroute";
    const label = coerceString(raw.action.label) || "Update trip";
    action = { type, label };
  }

  return {
    severity,
    title: title || detail,
    detail: title && detail && title !== detail ? detail : "",
    action,
  };
}

export function normalizeTripTips(rawTips) {
  if (!Array.isArray(rawTips)) {
    const one = normalizeTripTip(rawTips);
    return one ? [one] : [];
  }
  const out = [];
  const seen = new Set();
  for (const item of rawTips) {
    const tip = normalizeTripTip(item);
    if (!tip) continue;
    const key = `${tip.severity}:${tip.title}:${tip.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tip);
  }
  const actions = out.filter(t => t.severity === "action");
  if (actions.length > 2) {
    const keep = new Set(actions.slice(0, 2).map(t => t.title));
    return out.filter(t => t.severity !== "action" || keep.has(t.title));
  }
  return out;
}

export function splitTripTips(tips = []) {
  const normalized = normalizeTripTips(tips);
  return {
    action: normalized.filter(t => t.severity === "action"),
    advisory: normalized.filter(t => t.severity === "advisory"),
    info: normalized.filter(t => t.severity === "info"),
    more: normalized.filter(t => t.severity === "info" || t.severity === "advisory"),
  };
}

function tipKey(tip) {
  return `${tip.severity}:${tip.title}:${tip.detail}`;
}

/** Action tips always visible; up to two advisory/info tips shown expanded by default. */
export function pickDefaultExpandedTips(tips = [], maxNonAction = 2) {
  const normalized = tipsForDisplay(tips);
  const actions = normalized.filter(t => t.severity === "action");
  const others = normalized
    .filter(t => t.severity !== "action")
    .sort((a, b) => {
      const rank = { advisory: 0, info: 1 };
      return (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2);
    });
  const expanded = [...actions, ...others.slice(0, maxNonAction)];
  const expandedKeys = new Set(expanded.map(tipKey));
  const collapsed = normalized.filter(t => !expandedKeys.has(tipKey(t)));
  return { expanded, collapsed };
}

export function formatActionTipDirective(tip) {
  if (!tip?.action) return "";
  const subject = [tip.title, tip.detail].filter(Boolean).join(" — ");
  if (tip.action.type === "depart_earlier") {
    return `MUST: Adjust the plan to depart earlier — ${subject}`;
  }
  return `MUST: Reroute or adjust stops per this advisory — ${subject}`;
}

export function formatActionTipsBlock(tips = []) {
  const lines = normalizeTripTips(tips)
    .filter(t => t.severity === "action")
    .map(formatActionTipDirective)
    .filter(Boolean)
    .map(line => sanitizeHintText(line, 400));
  if (!lines.length) return "";
  return sanitizeHintText(
    ["=== TRIP TIP DIRECTIVES (address in regenerated plan) ===", ...lines.map(l => `- ${l}`)].join("\n"),
  );
}

/** Reject bare weather-only tips for display. */
export function isBareWeatherTip(tip) {
  const text = `${tip?.title || ""} ${tip?.detail || ""}`.toLowerCase();
  if (!text.trim()) return true;
  const weatherOnly = /^\s*(clear|sunny|partly cloudy|mostly sunny|fair skies|no precipitation|temperature|temp\.?)\b/i.test(text)
    && !/(storm|rain|snow|ice|wind|heat|flood|delay|reroute|depart|range|grade|chain|tire|hazard|closure|advisory|avoid)/i.test(text);
  return weatherOnly;
}

export function tipsForDisplay(rawTips) {
  return normalizeTripTips(rawTips).filter(t => !isBareWeatherTip(t));
}
