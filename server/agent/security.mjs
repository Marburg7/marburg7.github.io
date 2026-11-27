/**
 * Security, Environment Loading, Request Validation, Rate Limiting & Prompt-Injection Defense
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../..");

/* --- Lightweight .env Loader (No External Dependencies) --- */
let envLoaded = false;
export function loadEnvFile() {
  if (envLoaded) return;
  envLoaded = true;
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

/* --- Sliding-Window Rate Limiter --- */
const rateBuckets = new Map();

export function createRateLimiter({ maxRequests, windowMs } = {}) {
  const limit = Number(maxRequests || process.env.RATE_LIMIT_MAX || 20);
  const windowDuration = Number(windowMs || process.env.RATE_LIMIT_WINDOW_MS || 60000);

  return function checkRateLimit(clientKey) {
    const now = Date.now();
    const key = String(clientKey || "unknown");
    let timestamps = rateBuckets.get(key) || [];
    timestamps = timestamps.filter((ts) => now - ts < windowDuration);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0];
      const retryAfterSec = Math.max(1, Math.ceil((windowDuration - (now - oldest)) / 1000));
      rateBuckets.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfterSec, limit };
    }

    timestamps.push(now);
    rateBuckets.set(key, timestamps);

    // Prevent unbounded map growth
    if (rateBuckets.size > 2000) {
      for (const [k, v] of rateBuckets.entries()) {
        if (!v.length || now - v[v.length - 1] > windowDuration) rateBuckets.delete(k);
      }
    }

    return { allowed: true, remaining: Math.max(0, limit - timestamps.length), retryAfterSec: 0, limit };
  };
}

export function resetRateLimitsForTest() {
  rateBuckets.clear();
}

/* --- Prompt-Injection & Exfiltration Detection --- */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts|rules|directives)/i,
  /disregard\s+(all\s+)?(previous|system|your)\s+(instructions|rules|prompt)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|api\s+key|environment\s+variables|secrets)/i,
  /print\s+(process\.env|env|api[_\s-]?key|system\s+prompt)/i,
  /you\s+are\s+now\s+(dan|an?\s+unrestricted|jailbroken|root|admin)/i,
  /\b(bypass|override)\s+(safety|security|system|guardrails|rules)\b/i,
  /<\s*script\b|javascript:/i,
];

export function detectPromptInjection(text) {
  const input = String(text || "");
  for (const re of INJECTION_PATTERNS) {
    if (re.test(input)) {
      return { flagged: true, pattern: re.source };
    }
  }
  return { flagged: false, pattern: null };
}

/* --- Strict Request Validation --- */
export function validateAgentRequest(body) {
  const maxChars = Number(process.env.MAX_MESSAGE_CHARS || 6000);
  const maxHistory = Number(process.env.MAX_HISTORY_TURNS || 10);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, status: 400, error: "Request body must be a JSON object." };
  }

  const rawMessage = body.message;
  if (typeof rawMessage !== "string" || !rawMessage.trim()) {
    return { valid: false, status: 400, error: "Field 'message' must be a non-empty string." };
  }

  const message = rawMessage.trim();
  if (message.length > maxChars) {
    return {
      valid: false,
      status: 400,
      error: `Message exceeds the ${maxChars}-character limit. Please shorten your input or paste the key requirements of the job description.`,
    };
  }

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const sanitizedHistory = [];
  for (const item of rawHistory.slice(-maxHistory * 2)) {
    if (!item || typeof item !== "object") continue;
    const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
    if (!role || typeof item.content !== "string") continue;
    const content = item.content.trim().slice(0, 1800);
    if (content) sanitizedHistory.push({ role, content });
  }

  const mode = body.mode === "jd" ? "jd" : "chat";
  const SUPPORTED_LANGS = new Set(["en", "de", "it", "fr", "hi", "ar"]);
  const rawLang = typeof body.lang === "string" ? body.lang.toLowerCase().trim() : "en";
  const lang = SUPPORTED_LANGS.has(rawLang) ? rawLang : "en";

  return {
    valid: true,
    data: {
      message,
      history: sanitizedHistory,
      mode,
      lang,
    },
  };
}

/* --- Security Headers & CORS --- */
export function applySecurityHeaders(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' mailto:;"
  );

  const origin = req.headers?.origin;
  if (!origin) return;

  const allowed = String(
    process.env.ALLOWED_ORIGINS ||
      "http://localhost:3000,http://127.0.0.1:3000,https://syedshahbuddin.github.io"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const isLocalDev = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (allowed.includes(origin) || isLocalDev) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

export function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

