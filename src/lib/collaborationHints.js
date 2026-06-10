/** Format group votes/suggestions for Sonnet regeneration hints. */

function voteSummary(votes, stopKey) {
  const rows = (votes || []).filter(v => v.stopKey === stopKey);
  const up = rows.filter(v => v.vote === 1).length;
  const down = rows.filter(v => v.vote === -1).length;
  return { up, down, total: rows.length };
}

export function formatCollaborationHints(collaboration, stops = []) {
  if (!collaboration) return "";

  const lines = ["=== GROUP COLLABORATION INPUT (factor into this regeneration) ==="];

  const prefs = collaboration.preferences || [];
  if (prefs.length) {
    lines.push("", "Collaborator preferences:");
    prefs.forEach(p => {
      const parts = [];
      if (p.dietary) parts.push(`diet: ${p.dietary}`);
      if (p.travelPreferences) parts.push(`travel: ${p.travelPreferences}`);
      if (parts.length) lines.push(`- ${p.displayName || "Guest"}: ${parts.join("; ")}`);
    });
  }

  const suggestions = collaboration.suggestions || [];
  if (suggestions.length) {
    lines.push("", "Alternative stop suggestions:");
    suggestions.forEach(s => {
      const at = s.stopIndex != null ? ` (near day ${s.stopIndex + 1})` : "";
      lines.push(`- ${s.displayName || "Guest"} suggests "${s.placeName}"${at}${s.note ? ` — ${s.note}` : ""}`);
    });
  }

  const votes = collaboration.votes || [];
  if (votes.length && stops.length) {
    lines.push("", "Stop votes (prefer highly rated stops, reconsider downvoted):");
    stops.forEach((stop, i) => {
      const key = `stop-${i}`;
      const { up, down } = voteSummary(votes, key);
      const label = stop?.name || stop?.city || `Stop ${i + 1}`;
      if (up || down) lines.push(`- ${label}: ${up} thumbs up, ${down} thumbs down`);
    });
  } else if (votes.length) {
    lines.push("", `Total votes recorded: ${votes.length}`);
  }

  if (lines.length <= 1) return "";
  return lines.join("\n");
}

export function listCollabResponders(collaboration) {
  const seen = new Map();
  for (const row of [
    ...(collaboration?.votes || []),
    ...(collaboration?.suggestions || []),
    ...(collaboration?.preferences || []),
  ]) {
    if (!row.participantId) continue;
    if (!seen.has(row.participantId)) {
      seen.set(row.participantId, row.displayName || "Guest");
    }
  }
  return [...seen.entries()].map(([id, name]) => ({ participantId: id, displayName: name }));
}

export function voteTotalsByStop(votes, stops = []) {
  return stops.map((stop, i) => {
    const key = `stop-${i}`;
    const rows = (votes || []).filter(v => v.stopKey === key);
    return {
      stopKey: key,
      label: stop?.name || stop?.city || `Stop ${i + 1}`,
      up: rows.filter(v => v.vote === 1).length,
      down: rows.filter(v => v.vote === -1).length,
    };
  });
}

export function summarizeCollabActivity(collaboration) {
  const invitees = collaboration?.invitees?.length ?? 0;
  const votes = collaboration?.votes?.length ?? 0;
  const suggestions = collaboration?.suggestions?.length ?? 0;
  const prefs = collaboration?.preferences?.length ?? 0;
  const responded = new Set([
    ...(collaboration?.votes || []).map(v => v.participantId),
    ...(collaboration?.suggestions || []).map(s => s.participantId),
    ...(collaboration?.preferences || []).map(p => p.participantId),
  ]).size;
  return { invitees, votes, suggestions, prefs, responded };
}
