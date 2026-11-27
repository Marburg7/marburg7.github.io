/**
 * Serverless Endpoint Adapter (Vercel / Node.js Serverless Functions)
 * Allows deploying the AI Portfolio Agent backend to Vercel and connecting it
 * to the static GitHub Pages frontend via window.SYED_AGENT_ENDPOINT.
 */
import {
  loadEnvFile,
  createRateLimiter,
  validateAgentRequest,
  applySecurityHeaders,
  getClientIp,
} from "../server/agent/security.mjs";
import { orchestrateAgentTurn } from "../server/agent/orchestrator.mjs";

loadEnvFile();
const checkRateLimit = createRateLimiter();

export default async function handler(req, res) {
  applySecurityHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Method Not Allowed. Use POST." }));
    return;
  }

  const contentType = String(req.headers?.["content-type"] || "");
  if (!contentType.includes("application/json")) {
    res.statusCode = 415;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Content-Type must be application/json." }));
    return;
  }

  const rate = checkRateLimit(getClientIp(req));
  res.setHeader("X-RateLimit-Limit", String(rate.limit));
  res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
  if (!rate.allowed) {
    res.setHeader("Retry-After", String(rate.retryAfterSec));
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: `Rate limit exceeded. Retry in ${rate.retryAfterSec}s.` }));
    return;
  }

  let body;
  try {
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf-8") > 32768) {
        res.statusCode = 413;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Payload too large." }));
        return;
      }
      body = JSON.parse(req.body || "{}");
    } else {
      body = req.body;
    }
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Malformed JSON body." }));
    return;
  }
  const validation = validateAgentRequest(body);
  if (!validation.valid) {
    res.statusCode = validation.status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

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
  } catch {
    emit("error", { error: "Unexpected agent error. Please retry." });
  } finally {
    if (!res.writableEnded) res.end();
  }
}

