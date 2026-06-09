import { loadEnv } from "vite";
import apiRouter from "../api/router.js";
import { resolveApiRoute } from "../api/resolveApiRoute.js";

function readRawRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return Promise.resolve(Buffer.alloc(0));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function createVercelLikeResponse(res) {
  let statusCode = 200;
  const headers = {};
  let headersWritten = false;

  const applyHeaders = () => {
    if (headersWritten) return;
    res.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
    headersWritten = true;
  };

  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    write(chunk) {
      applyHeaders();
      return res.write(chunk);
    },
    flushHeaders() {
      applyHeaders();
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }
      return this;
    },
    json(payload) {
      if (res.writableEnded) return undefined;
      applyHeaders();
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
      return undefined;
    },
    end(body) {
      if (res.writableEnded) return undefined;
      applyHeaders();
      res.end(body);
      return undefined;
    },
    get headersSent() {
      return headersWritten;
    },
  };
}

/** Vite dev middleware — serves /api/* through api/router.js (same as Vercel production). */
export function viteApiDevPlugin(mode = "development") {
  return {
    name: "tripmappa-api-dev",
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || "";
        if (!url.startsWith("/api/") && url !== "/api") return next();

        try {
          const pathname = url.split("?")[0];
          const routeFromPath = pathname.replace(/^\/api\/?/, "");
          const rawBody = await readRawRequestBody(req);
          const route = resolveApiRoute({
            method: req.method,
            url,
            headers: req.headers,
            query: { path: routeFromPath },
          });
          const isStripeWebhook = route === "stripe/webhook";
          const mockReq = {
            method: req.method,
            url,
            headers: req.headers,
            query: { path: route },
            rawBody,
          };
          if (isStripeWebhook) {
            mockReq.body = undefined;
          } else if (rawBody.length) {
            try {
              mockReq.body = JSON.parse(rawBody.toString("utf8"));
            } catch {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
              return;
            }
          } else {
            mockReq.body = undefined;
          }

          await apiRouter(mockReq, createVercelLikeResponse(res));
          if (!res.writableEnded) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: `Unknown API route: /api/${route || "(missing path)"}` }));
          }
        } catch (err) {
          console.error("[vite-api-dev]", err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: err.message || "Internal server error" }));
          }
        }
      });
    },
  };
}
