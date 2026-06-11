/** Per-field caps and sanitization for Sonnet generation hint blocks. */

export const HINT_BLOCK_MAX = 2000;
export const HINT_LINE_MAX = 400;

const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeHintText(value, maxLen = HINT_BLOCK_MAX) {
  if (value == null) return "";
  let text = String(value).replace(CONTROL_RE, "").trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}

export function sanitizeHintLines(lines, { maxLines = 40, lineMax = HINT_LINE_MAX } = {}) {
  if (!Array.isArray(lines)) return [];
  return lines
    .slice(0, maxLines)
    .map(line => sanitizeHintText(line, lineMax))
    .filter(Boolean);
}
