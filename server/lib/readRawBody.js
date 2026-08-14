/** Read unparsed request body (required for Stripe webhook signature verification). */

export async function readRawBody(req, { maxBytes = null } = {}) {
  if (req.rawBody != null) {
    const buf = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(String(req.rawBody), "utf8");
    if (maxBytes != null && buf.length > maxBytes) {
      const err = new Error("Payload too large");
      err.statusCode = 413;
      throw err;
    }
    return buf;
  }

  if (typeof req.body === "string") {
    const buf = Buffer.from(req.body, "utf8");
    if (maxBytes != null && buf.length > maxBytes) {
      const err = new Error("Payload too large");
      err.statusCode = 413;
      throw err;
    }
    return buf;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (maxBytes != null && total > maxBytes) {
      const err = new Error("Payload too large");
      err.statusCode = 413;
      throw err;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
