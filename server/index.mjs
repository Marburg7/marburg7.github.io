/**
 * Syed Shahabuddin Portfolio + AI Agent Server (Node.js ESM, Zero Dependencies)
 * Serves static portfolio routes AND secure server-side AI agent endpoints:
 *   GET  /api/health  -> Provider & configuration status (never leaks secrets)
 *   POST /api/agent   -> Validated, rate-limited, streaming SSE AI agent endpoint
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnvFile,
  createRateLimiter,
  validateAgentRequest,
  applySecurityHeaders,
  getClientIp,
} from "./agent/security.mjs";
import { orchestrateAgentTurn, getActiveProviderInfo } from "./agent/orchestrator.mjs";
import { loadKnowledge } from "./agent/knowledge.mjs";

loadEnvFile();
loadKnowledge();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const BLOCKED_STATIC_PREFIXES = ["/server", "/api", "/tests", "/scripts", "/package.json", "/package-lock.json", "/README.md"];

function readJsonBody(req, maxBytes = 32768) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("Malformed JSON body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

export function createAppServer(options = {}) {
  const checkRateLimit = createRateLimiter(options.rateLimit);

  return http.createServer(async (req, res) => {
    applySecurityHeaders(req, res);

    const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = urlObj.pathname;

    // Handle CORS preflight
    if (req.method === "OPTIONS" && pathname.startsWith("/api/")) {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health Endpoint
    if (pathname === "/api/health" && req.method === "GET") {
      const info = getActiveProviderInfo();
      sendJson(res, 200, {
        status: "ok",
        provider: info.provider,
        mode: info.mode,
        model: info.model,
        streaming: true,
        toolsEnabled: true,
      });
      return;
    }

    // AI Agent Endpoint (SSE Streaming)
    if (pathname === "/api/agent") {
      if (req.method !== "POST") {
        sendJson(res, 405, { error: "Method Not Allowed. Use POST /api/agent." });
        return;
      }

      const contentType = String(req.headers["content-type"] || "");
      if (!contentType.includes("application/json")) {
        sendJson(res, 415, { error: "Content-Type must be application/json." });
        return;
      }

      const ip = getClientIp(req);
      const rate = checkRateLimit(ip);
      res.setHeader("X-RateLimit-Limit", String(rate.limit));
      res.setHeader("X-RateLimit-Remaining", String(rate.remaining));

      if (!rate.allowed) {
        res.setHeader("Retry-After", String(rate.retryAfterSec));
        sendJson(res, 429, {
          error: `Rate limit exceeded. Please wait ${rate.retryAfterSec}s before sending another message.`,
          retryAfterSec: rate.retryAfterSec,
        });
        return;
      }

      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        sendJson(res, err.status || 400, { error: err.message });
        return;
      }

      const validation = validateAgentRequest(body);
      if (!validation.valid) {
        sendJson(res, validation.status, { error: validation.error });
        return;
      }

      // Open Server-Sent Events stream
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });

      const emit = (event, payload) => {
        if (res.writableEnded) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      try {
        await orchestrateAgentTurn({
          message: validation.data.message,
          history: validation.data.history,
          mode: validation.data.mode,
          lang: validation.data.lang,
          emit,
        });
      } catch (err) {
        emit("error", { error: "The AI agent encountered an unexpected error. Please retry." });
      } finally {
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // Static Portfolio Serving (strictly prevent directory traversal & server file exposure)
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("Method Not Allowed");
      return;
    }

    let decodedPath;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }

    const normalized = path.posix.normalize(decodedPath);
    const hasHiddenSegment = normalized.split("/").some((seg) => seg.startsWith("."));
    if (
      normalized.includes("..") ||
      hasHiddenSegment ||
      BLOCKED_STATIC_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))
    ) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let filePath = path.join(ROOT_DIR, normalized === "/" ? "index.html" : normalized);
    if (!filePath.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      const notFoundPage = path.join(ROOT_DIR, "404.html");
      if (fs.existsSync(notFoundPage)) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        fs.createReadStream(notFoundPage).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const cacheControl = ext === ".html" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": cacheControl,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

// Start server when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = createAppServer();
  server.listen(port, host, () => {
    const info = getActiveProviderInfo();
    console.log(`Syed Portfolio & AI Agent Server listening on http://${host}:${port}`);
    console.log(`Active Agent Provider: ${info.provider} (${info.mode}, model=${info.model})`);
  });
}

