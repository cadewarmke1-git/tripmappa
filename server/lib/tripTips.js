/** Normalize structured trip tips from Sonnet JSON. */

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
