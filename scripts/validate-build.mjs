/**
 * Production Build, Security & Deployment Validator (`npm run build`)
 * Checks:
 *  1. Structured knowledge base JSON schema validity
 *  2. JavaScript syntax across all client & server modules
 *  3. Security invariants: zero exposed secrets, zero local paths, zero inline event handlers,
 *     rel="noopener" on all external _blank links, .env ignored by git
 *  4. HTML local link & asset integrity across all pages
 *  5. GitHub Pages production files (.nojekyll, 404.html, robots.txt, sitemap.xml)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const errors = [];

// 1. Validate structured knowledge base
try {
  const kb = JSON.parse(fs.readFileSync(path.join(ROOT, "data/portfolio-knowledge.json"), "utf-8"));
  if (!kb.profile?.name || !Array.isArray(kb.projects) || kb.projects.length < 7 || !Array.isArray(kb.skills)) {
    errors.push("portfolio-knowledge.json missing required profile, projects, or skills fields.");
  }
} catch (err) {
  errors.push(`Invalid data/portfolio-knowledge.json: ${err.message}`);
}

// 2. Check syntax of every JS/MJS module
const jsFiles = [
  "js/script.js",
  "js/agent-ui.js",
  "server/index.mjs",
  "server/agent/knowledge.mjs",
  "server/agent/tools.mjs",
  "server/agent/prompt.mjs",
  "server/agent/security.mjs",
  "server/agent/orchestrator.mjs",
  "api/agent.mjs",
];

for (const rel of jsFiles) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    errors.push(`Missing expected script: ${rel}`);
    continue;
  }
  try {
    execFileSync(process.execPath, ["--check", full], { stdio: "pipe" });
  } catch (err) {
    errors.push(`Syntax error in ${rel}: ${err.stderr?.toString() || err.message}`);
  }
}

// 3. Verify GitHub Pages production files exist
for (const prodFile of [".nojekyll", "404.html", "robots.txt", "sitemap.xml", ".gitignore", ".env.example"]) {
  if (!fs.existsSync(path.join(ROOT, prodFile))) {
    errors.push(`Missing production deployment file: ${prodFile}`);
  }
}

// 4. Verify .env is gitignored (never committed)
try {
  const trackedEnv = execFileSync("git", ["ls-files", ".env"], { encoding: "utf-8" }).trim();
  if (trackedEnv) {
    errors.push("CRITICAL: .env is tracked by git! Remove it with `git rm --cached .env`.");
  }
} catch {
  // git check skipped if not a git repo
}

// 5. Scan all repository text files (excluding .env & .git) for secrets, local paths, and unsafe HTML
const secretPatterns = [
  /AIza[0-9A-Za-z_-]{20,}/,
  /sk-[0-9A-Za-z_-]{20,}/,
  /ghp_[0-9A-Za-z]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];
const localPathPattern = /\/Users\/[A-Za-z0-9._-]+/;

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

const allFiles = walkFiles(ROOT);
let htmlCount = 0;

for (const file of allFiles) {
  const rel = path.relative(ROOT, file);
  if (rel === ".env" || rel.startsWith(".env.local")) continue;
  const ext = path.extname(file).toLowerCase();
  if (![".html", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".xml"].includes(ext)) continue;

  const content = fs.readFileSync(file, "utf-8");

  if (rel !== "scripts/validate-build.mjs") {
    for (const re of secretPatterns) {
      if (re.test(content)) errors.push(`Potential secret pattern detected in ${rel}`);
    }
    if (localPathPattern.test(content)) {
      errors.push(`Local machine path leak detected in ${rel}`);
    }
  }

  if (ext === ".html") {
    htmlCount++;
    const baseDir = path.dirname(file);

    // Check external _blank links have noopener
    for (const m of content.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
      if (!/rel="[^"]*noopener[^"]*"/i.test(m[0])) {
        errors.push(`Missing rel="noopener" on target="_blank" in ${rel}`);
      }
    }

    // Check no inline JS event handlers
    if (/\son[a-z]+\s*=/i.test(content)) {
      errors.push(`Inline event handler detected in ${rel}`);
    }

    // Check CSP meta tag exists
    if (!/http-equiv="Content-Security-Policy"/i.test(content)) {
      errors.push(`Missing Content-Security-Policy meta tag in ${rel}`);
    }

    // Check all local href/src resolve cleanly
    for (const match of content.matchAll(/(href|src)="([^"]+)"/g)) {
      const val = match[2];
      if (/^(https?:|mailto:|tel:|#|data:)/i.test(val)) continue;
      const clean = val.split("#")[0].split("?")[0];
      if (!clean) continue;
      let target = clean.startsWith("/")
        ? path.join(ROOT, clean.slice(1))
        : path.resolve(baseDir, clean);
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        target = path.join(target, "index.html");
      }
      if (!fs.existsSync(target)) {
        errors.push(`Broken ${match[1]} in ${rel}: ${val}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Production build & security validation FAILED:");
  for (const e of errors) console.error("  -", e);
  process.exit(1);
}

console.log(`Production build & security validation PASSED (${jsFiles.length} JS modules, ${htmlCount} HTML pages, CSP + secret + link + deployment checks clean).`);
