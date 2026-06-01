/** Track question-flow answer changes for low-confidence intent detection. */

export function createAnswerChangeTracker() {
  return {};
}

export function recordAnswerChange(tracker, questionId, previousValue, newValue) {
  if (!questionId || previousValue === undefined) return tracker;
  if (JSON.stringify(previousValue) === JSON.stringify(newValue)) return tracker;
  const next = { ...tracker };
  next[questionId] = (next[questionId] || 0) + 1;
  return next;
}

export function getLowConfidenceQuestions(tracker, questionLabels = {}) {
  return Object.entries(tracker || {})
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({
      id,
      label: questionLabels[id] || id,
      changeCount: count,
    }));
}

export function formatAnswerConfidenceNotes(tracker, questionLabels = {}) {
  const uncertain = getLowConfidenceQuestions(tracker, questionLabels);
  if (!uncertain.length) return "";
  const lines = [
    "=== ANSWER CONFIDENCE (user changed these preferences more than once — offer flexible options) ===",
  ];
  for (const item of uncertain) {
    lines.push(`- ${item.label}: user revised this answer ${item.changeCount} times during the question flow. Surface flexible alternatives for this category rather than a single rigid recommendation.`);
  }
  return lines.join("\n");
}

export function buildQuestionLabelMap(questionHistory = []) {
  const map = {};
  for (const entry of questionHistory) {
    const id = entry?.question?.id;
    const ask = entry?.question?.ask;
    if (id && ask) map[id] = ask;
  }
  return map;
}
