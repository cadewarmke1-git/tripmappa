/** Extract and parse JSON from LLM text (fences, preamble, truncation). */

function stripCodeFences(text) {
  let stripped = String(text).trim();
  stripped = stripped.replace(/^```(?:json)?\s*/i, "");
  stripped = stripped.replace(/\s*```\s*$/i, "");
  stripped = stripped.replace(/```json/gi, "").replace(/```/g, "").trim();
  return stripped;
}

function tryParseJson(candidate, failures) {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    failures.push({
      strategy: "direct",
      length: trimmed.length,
      message: err.message,
      preview: trimmed.slice(0, 120),
      tail: trimmed.slice(-120),
    });
    return null;
  }
}

/** Walk from each `{` and collect brace-balanced object substrings. */
function collectBalancedObjects(text) {
  const out = [];
  const s = String(text);
  for (let start = 0; start < s.length; start += 1) {
    if (s[start] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < s.length; i += 1) {
      const ch = s[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          out.push(s.slice(start, i + 1));
          break;
        }
      }
    }
  }
  return out;
}

/** Close unterminated strings and trailing open braces/brackets for truncated JSON. */
function repairTruncatedJson(text) {
  const s = String(text).trim();
  if (!s.startsWith("{")) return null;

  let inString = false;
  let escaped = false;
  const stack = [];

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }

  let repaired = s;
  if (inString) repaired += "\"";
  while (stack.length) repaired += stack.pop();
  return repaired;
}

function uniqueByLengthDesc(items) {
  const seen = new Set();
  const out = [];
  for (const item of [...items].sort((a, b) => b.length - a.length)) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function buildCandidates(stripped) {
  const candidates = [];
  candidates.push(stripped);

  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(stripped.slice(firstBrace, lastBrace + 1));
  }

  const greedy = stripped.match(/\{[\s\S]*\}/);
  if (greedy?.[0]) candidates.push(greedy[0]);

  candidates.push(...collectBalancedObjects(stripped));

  const repaired = repairTruncatedJson(stripped);
  if (repaired) candidates.push(repaired);

  if (firstBrace >= 0) {
    const partial = stripped.slice(firstBrace);
    const repairedPartial = repairTruncatedJson(partial);
    if (repairedPartial) candidates.push(repairedPartial);
  }

  return uniqueByLengthDesc(candidates);
}

export function parseJsonFromLlm(text) {
  if (!text) {
    console.error("parseJsonFromLlm: empty model response");
    throw new Error("Empty model response");
  }

  const raw = String(text);
  const stripped = stripCodeFences(raw);
  const failures = [];
  const candidates = buildCandidates(stripped);

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate, failures);
    if (parsed !== null && typeof parsed === "object") {
      return parsed;
    }
  }

  const lastFailure = failures[failures.length - 1];
  console.error("parseJsonFromLlm: unparseable response", {
    length: raw.length,
    strippedLength: stripped.length,
    candidateCount: candidates.length,
    lastError: lastFailure?.message || "unknown",
    preview: stripped.slice(0, 200),
    tail: stripped.slice(-200),
    strategiesTried: failures.length,
  });
  throw new Error(
    `Could not parse trip JSON from model — ${lastFailure?.message || "response was not valid JSON"}`,
  );
}
