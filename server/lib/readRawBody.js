/** Read unparsed request body (required for Stripe webhook signature verification). */
export async function readRawBody(req) {
  if (req.rawBody != null) {
    return Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(String(req.rawBody), "utf8");
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body, "utf8");
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
