import { loadEnv } from "vite";
import apiRouter from "../api/router.js";
import { resolveApiRoute } from "../api/resolveApiRoute.js";

function readRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function createVercelLikeResponse(res) {
  let statusCode = 200;
  const headers = {};
  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
    json(payload) {
      if (res.writableEnded) return undefined;
      res.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(payload));
      return undefined;
    },
    end(body) {
      if (res.writableEnded) return undefined;
      res.statusCode = statusCode;
      for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
      }
      res.end(body);
      return undefined;
    },
    get headersSent() {
      return res.writableEnded;
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
          const body = await readRequestBody(req);
          const mockReq = {
            method: req.method,
            url,
            headers: req.headers,
            query: { path: routeFromPath },
            body,
          };
          const route = resolveApiRoute(mockReq);
          mockReq.query = { path: route };

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
