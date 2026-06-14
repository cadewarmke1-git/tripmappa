/** Extract stop names/cities from partial plan-trip JSON without nested hotel/restaurant noise. */

function unescapeJsonString(value) {
  return String(value || "").replace(/\\"/g, '"').trim();
}

function extractTopLevelArrayFields(text, arrayKey, field) {
  const anchor = text.match(new RegExp(`"${arrayKey}"\\s*:\\s*\\[`));
  if (!anchor) return [];
  const slice = text.slice(anchor.index);
  const names = [];
  const seen = new Set();
  const pattern = new RegExp(`\\{\\s*"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*?)"`, "g");
  for (const match of slice.matchAll(pattern)) {
    const name = unescapeJsonString(match[1]);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Any occurrence of field in a flat array section (road_stops items are not nested). */
function extractFlatArrayFields(text, arrayKey, field) {
  const anchor = text.match(new RegExp(`"${arrayKey}"\\s*:\\s*\\[`));
  if (!anchor) return [];
  const slice = text.slice(anchor.index);
  const names = [];
  const seen = new Set();
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*?)"`, "g");
  for (const match of slice.matchAll(pattern)) {
    const name = unescapeJsonString(match[1]);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function extractStreamStopProgress(text = "") {
  const raw = String(text);
  const summaryMatch = raw.match(/"route_summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const cityNames = [
    ...extractTopLevelArrayFields(raw, "stops", "city"),
    ...extractFlatArrayFields(raw, "road_stops", "city"),
  ];
  const uniqueCities = [...new Set(cityNames)];
  const stopNames = extractTopLevelArrayFields(raw, "road_stops", "name");
  return {
    routeSummary: summaryMatch?.[1] ? unescapeJsonString(summaryMatch[1]) : null,
    cityNames: uniqueCities,
    stopNames,
    stopCount: uniqueCities.length + stopNames.length,
  };
}
