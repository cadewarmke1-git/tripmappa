/** SSE helpers and Anthropic streaming for /api/plan-trip. */
import { logPlanTripDev } from "./apiLog.js";

export function initPlanTripSse(res) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

export function writePlanTripSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Serialize SSE writes when multiple parallel segment streams are active. */
export function createPlanTripSseWriter(res) {
  let chain = Promise.resolve();
  return {
    write(event, data) {
      chain = chain.then(() => {
        writePlanTripSse(res, event, data);
      });
      return chain;
    },
    wait() {
      return chain;
    },
  };
}

export function buildStreamProgress(accumulatedText = "") {
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

  return {
    phase,
    chars: text.length,
    routeSummary: summaryMatch?.[1]?.replace(/\\"/g, '"') || null,
    stopNames: stopNames.slice(0, 16),
    cityNames: cityNames.slice(0, 8),
    stopCount: stopNames.length + cityNames.length,
  };
}

/**
 * Stream Anthropic Messages API; invokes onChunk for each text delta.
 * @returns {{ fullText: string, inputTokens: number, outputTokens: number, response: Response }}
 */
export async function streamAnthropicMessages({
  model,
  systemPrompt,
  userPrompt,
  maxTokens,
  onChunk,
  onProgress,
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    let message = "API error";
    try {
      const errBody = await response.json();
      message = errBody?.error?.message || message;
    } catch {
      /* ignore */
    }
    return {
      response,
      fullText: "",
      inputTokens: 0,
      outputTokens: 0,
      apiError: message,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let lastProgressAt = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }

      if (evt.type === "message_start" && evt.message?.usage) {
        inputTokens = evt.message.usage.input_tokens ?? inputTokens;
      }
      if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
        const piece = evt.delta.text || "";
        if (piece) {
          fullText += piece;
          onChunk?.(piece, fullText);
          const now = Date.now();
          if (onProgress && now - lastProgressAt >= 250) {
            onProgress(buildStreamProgress(fullText));
            lastProgressAt = now;
          }
        }
      }
      if (evt.type === "message_delta" && evt.usage) {
        outputTokens = evt.usage.output_tokens ?? outputTokens;
      }
    }
  }

  onProgress?.(buildStreamProgress(fullText));

  logPlanTripDev({
    event: "anthropic_usage",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  });

  return { response, fullText, inputTokens, outputTokens, apiError: null };
}
