/** Client-side SSE parsing and stream progress for /api/plan-trip. */

export function buildGenerationStreamProgress(accumulatedText = "") {
  const text = String(accumulatedText);
  const summaryMatch = text.match(/"route_summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const stopNames = [];
  for (const match of text.matchAll(/"name"\s*:\s*"((?:[^"\\]|\\.)*?)"/g)) {
    const name = match[1]?.replace(/\\"/g, '"').trim();
    if (name && !stopNames.includes(name)) stopNames.push(name);
  }
  const cityNames = [];
  for (const match of text.matchAll(/"city"\s*:\s*"((?:[^"\\]|\\.)*?)"/g)) {
    const city = match[1]?.replace(/\\"/g, '"').trim();
    if (city && !cityNames.includes(city)) cityNames.push(city);
  }

  const phase = stopNames.length > 0 || cityNames.length > 0
    ? "stops"
    : summaryMatch
      ? "route"
      : "streaming";

  let message = "Planning your route…";
  if (phase === "route" && summaryMatch?.[1]) {
    message = "Route summary ready — adding stops…";
  } else if (phase === "stops") {
    const latest = stopNames[stopNames.length - 1] || cityNames[cityNames.length - 1];
    message = latest ? `Adding ${latest}…` : "Building stops along your route…";
  }

  return {
    phase,
    chars: text.length,
    routeSummary: summaryMatch?.[1]?.replace(/\\"/g, '"') || null,
    stopNames: stopNames.slice(0, 16),
    cityNames: cityNames.slice(0, 8),
    stopCount: stopNames.length + cityNames.length,
    message,
  };
}

function parseSseFrames(buffer) {
  const frames = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    const dataLines = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) {
      try {
        frames.push({ event, data: JSON.parse(dataLines.join("\n")) });
      } catch {
        /* ignore partial */
      }
    }
  }
  return { frames, rest };
}

/**
 * Read plan-trip SSE stream; returns final parsed trip on `complete`.
 * @param {Response} response
 * @param {AbortSignal} [signal]
 * @param {(progress: object) => void} [onProgress]
 */
export async function readPlanTripSseStream(response, signal, onProgress) {
  if (!response.body) {
    throw new Error("Trip planning failed. Please try again in a moment.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let completePayload = null;
  let streamError = null;
  let parallelMode = false;
  let parallelLegProgress = null;

  const abortOnSignal = () => {
    reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener("abort", abortOnSignal);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = parseSseFrames(buffer);
      buffer = rest;

      for (const frame of frames) {
        if (frame.event === "start" && frame.data?.parallel) {
          parallelMode = true;
          parallelLegProgress = {
            totalSegments: frame.data.segmentCount || 2,
            completedSegments: 0,
            message: `Planning leg 1 of ${frame.data.segmentCount || 2}…`,
          };
          onProgress?.({
            phase: "parallel_start",
            ...parallelLegProgress,
          });
        } else if (frame.event === "chunk" && frame.data?.text) {
          accumulated += frame.data.text;
          if (!parallelMode) {
            onProgress?.(buildGenerationStreamProgress(accumulated));
          }
        } else if (frame.event === "progress") {
          if (parallelMode) {
            parallelLegProgress = {
              ...parallelLegProgress,
              ...frame.data,
            };
            onProgress?.({
              ...parallelLegProgress,
              ...frame.data,
            });
          } else {
            onProgress?.({
              ...buildGenerationStreamProgress(accumulated),
              ...frame.data,
            });
          }
        } else if (frame.event === "segment_complete") {
          const completed = (frame.data?.segmentIndex ?? 0) + 1;
          const total = frame.data?.totalSegments || parallelLegProgress?.totalSegments || 1;
          const segmentStopNames = (frame.data?.stops || [])
            .flatMap((stop) => [stop?.city, stop?.name])
            .filter(Boolean);
          const segmentRoadNames = (frame.data?.road_stops || [])
            .map((stop) => stop?.name || stop?.location)
            .filter(Boolean);
          parallelLegProgress = {
            phase: "segment_complete",
            segmentIndex: frame.data?.segmentIndex,
            totalSegments: total,
            completedSegments: completed,
            message: completed >= total
              ? `Finalizing trip (${completed} of ${total} legs complete)…`
              : `Planning leg ${Math.min(completed + 1, total)} of ${total}…`,
            stopNames: [...segmentStopNames, ...segmentRoadNames].slice(0, 16),
            cityNames: segmentStopNames.slice(0, 8),
            stopCount: completed,
          };
          onProgress?.(parallelLegProgress);
        } else if (frame.event === "complete") {
          completePayload = frame.data;
        } else if (frame.event === "error") {
          streamError = frame.data;
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", abortOnSignal);
  }

  if (streamError) {
    const err = new Error(streamError.error || "Failed to generate trip plan");
    err.code = streamError.code;
    err.credits = streamError.credits;
    err.limitReached = streamError.limitReached;
    err.resetDate = streamError.resetDate;
    err.tier = streamError.tier;
    throw err;
  }

  if (!completePayload) {
    throw new Error("Trip planning failed. Please try again in a moment.");
  }

  return completePayload;
}

/** Build client credit snapshot for fast server pre-flight. */
export function buildClientCreditSnapshot(status) {
  if (!status) return null;
  return {
    tier: status.tier,
    remaining: status.remaining,
    unlimited: status.unlimited,
    billingPeriod: status.billingPeriod,
    resetDate: status.resetDate,
    used: status.used,
    limit: status.limit,
    monthlyUsed: status.monthlyUsed,
    monthly_generation_count: status.monthlyUsed ?? status.monthly_generation_count,
    monthly_generation_reset_date: status.resetDate ?? status.monthly_generation_reset_date,
    generations_used: status.billingPeriod === "monthly" ? undefined : status.used,
  };
}

/** Optimistically decrement cached credits after a successful generation. */
export function decrementCachedCreditStatus(status) {
  if (!status || status.unlimited) return status;
  const remaining = Math.max(0, (Number(status.remaining) || 0) - 1);
  const used = (Number(status.used) || 0) + 1;
  const next = { ...status, remaining, used };
  if (status.billingPeriod === "monthly") {
    next.monthlyUsed = used;
    next.monthly_generation_count = used;
  } else {
    next.generations_used = used;
  }
  return next;
}
