# Syed Shahabuddin — Developer Portfolio & AI Portfolio Agent

Live Site: **[syedshahbuddin.github.io](https://syedshahbuddin.github.io/)**

A zero-dependency, security-hardened developer portfolio for **Syed Shahabuddin** (React.js & Full Stack Web Developer, 3+ years experience), engineered with an **Obsidian Forge & Luminous Amber** design system, interactive multi-screen case studies, and a dual-mode **AI Portfolio Agent** that runs seamlessly both on static GitHub Pages and with an optional Node.js / Vercel + Google Gemini backend.

---

## Highlights

- **Zero Runtime Dependencies**: Pure semantic HTML5, modern CSS3, vanilla ES modules, and native Node.js (`>=20`) APIs — fast initial load, zero bundler lock-in, and 100% GitHub Pages compatible.
- **Interactive Case Study Drawer & Multi-Screen Galleries**: Inspect shipped platforms directly on the page, including **Sovos Studio** (interactive 3-screen gallery covering the Report Canvas & Data Editor, USA Choropleth Map with hover tooltips, and Workspace Dashboard), **NovaCut Studio**, **Sovos Multisite Platform**, **Taxapedia**, **eFileMyForm**, **1099pro.com**, and **Eduleem.com**.
- **Intelligent AI Portfolio Agent (`Cmd/Ctrl + K`)**:
  - **Works Natively on GitHub Pages**: Automatically detects static `.github.io` hosting and runs a grounded client-side engine powered by `data/portfolio-knowledge.json` with progressive streaming and **zero 404 console errors**.
  - **Optional Server-Side SSE & Google Gemini Integration**: Connect `server/index.mjs` or `api/agent.mjs` (Vercel) with `GEMINI_API_KEY` for live tool-calling and Server-Sent Events streaming.
  - **Job Description Fit & Gap Analyzer**: Dedicated *Paste Job Description* tab that maps verified CV/project matches alongside honest gaps for undocumented skills.
  - **Interactive Actions & UX**: Safe Markdown + syntax-styled code blocks with Copy Code, Copy Response, live tool-trace badges, multi-turn follow-up context, one-click Case Study drawer triggers, minimize/clear/retry controls, and full keyboard accessibility.

---

## Project Structure

```text
.
├── index.html                  # Homepage (Hero, Capabilities, 7 Featured Projects, Experience, Stack, Contact)
├── projects/index.html         # Full project archive & interactive Case Study drawer
├── experience/index.html       # Career timeline (Sovos, Eduleem, ARM Infoserve), Education & Certifications
├── tools/index.html            # Technical skills & tooling matrix
├── blog/                       # Engineering & UI/UX writing index + 4 articles
├── 404.html                    # Branded GitHub Pages fallback page
├── .nojekyll                   # Disables Jekyll processing on GitHub Pages
├── robots.txt                  # Search engine crawl directives & sitemap reference
├── sitemap.xml                 # Canonical URL sitemap for all 9 routes
├── css/style.css               # Obsidian Forge & Luminous Amber design system & responsive layouts
├── js/
│   ├── script.js               # Interactions, motion, filters, Case Study drawer, lazy agent loader
│   └── agent-ui.js             # Streaming AI agent UI, safe Markdown renderer & GitHub Pages client engine
├── data/
│   └── portfolio-knowledge.json # Single source of truth grounded strictly in Syed's CV & portfolio
├── server/
│   ├── index.mjs               # Hardened Node.js HTTP server (static files, POST /api/agent SSE, GET /api/health)
│   └── agent/
│       ├── knowledge.mjs       # Selective top-K context retrieval
│       ├── tools.mjs           # Whitelisted read-only portfolio & JD analysis tools
│       ├── prompt.mjs          # Grounded, non-promotional system prompt with injection boundaries
│       ├── security.mjs        # Schema validation, rate limiting, prompt-injection defense, CORS & headers
│       └── orchestrator.mjs    # Multi-step tool-calling & SSE loop (Google Gemini API + local fallback)
├── api/agent.mjs               # Vercel serverless endpoint adapter for pairing with GitHub Pages
├── scripts/validate-build.mjs  # Production build, CSP, secret-scan, link & deployment validator (`npm run build`)
└── tests/agent.test.mjs        # Automated unit, API, SSE, JD-matching & security tests (`npm test`)
```

---

## Security & Production Hardening

- **Strict Content Security Policy (CSP)**: Enforced across all 10 HTML pages (`script-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self' mailto:`) and server HTTP headers (plus `frame-ancestors 'self'`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`).
- **XSS & URL Protocol Protection**: Safe DOM construction (`textContent`), sanitized Markdown rendering, strict `isSafeHref` validation rejecting control characters/unsafe schemes, and `rel="noopener noreferrer"` on all external `_blank` links.
- **Server & API Defenses**: Blocks dotfiles (`.env`, `.gitignore`) and private source directories (`/server`, `/api`, `/tests`, `/scripts`, `/package.json`, `/README.md`) with `403`, rejects malformed URIs (`400`), enforces `Content-Type: application/json` (`415`) and a 32 KB body cap (`413`), applies sliding-window IP rate limiting (`429`), and guards against prompt injection on both server and client.
- **Automated Security Gate (`npm run build`)**: Validates JSON schema, JS syntax across all 9 modules, presence of GitHub Pages deployment files, CSP meta tags on every HTML file, broken local links/assets, exposed secret patterns, local machine path leaks, and ensures `.env` is never tracked by Git.

---

## Local Development

### Prerequisites
- Node.js `>= 20.0.0` (no `npm install` needed — zero external dependencies)

### Environment Setup (Optional)
1. Copy the template environment file:
   ```bash
   cp .env.example .env
   ```
2. Optionally set `GEMINI_API_KEY` (defaults to `GEMINI_MODEL=gemini-2.5-flash`) inside `.env`.
   - Never commit `.env` or place API keys in frontend files.
   - If `GEMINI_API_KEY` is left blank, the server runs automatically in grounded `local-orchestrator` mode with selective retrieval, tool execution, JD analysis, and SSE streaming.

### Commands

```bash
# Start local portfolio + AI agent server (default http://127.0.0.1:3000)
npm start

# Start server with automatic file-watch reload
npm run dev

# Run automated unit, API, SSE, JD-analyzer & security tests
npm test

# Run production build, CSP, secret, link & deployment integrity checks
npm run build
```

---

## Deploying to GitHub Pages

### Static Deployment (Default — Zero Configuration)
1. Push to the `main` branch of `Syedshahbuddin.github.io`:
   ```bash
   git add .
   git commit -m "Deploy production portfolio"
   git push origin main
   ```
2. In **GitHub Repository Settings → Pages**, confirm:
   - **Source**: Deploy from branch `main` / `/ (root)`
   - **Enforce HTTPS**: Enabled

GitHub Pages will serve the full site with `.nojekyll`, `404.html`, `robots.txt`, `sitemap.xml`, strict CSP meta tags, and the grounded client-side AI Portfolio Agent out of the box.

### Optional: Connect Live Gemini Serverless Backend (Vercel)
1. Deploy this repository's `api/agent.mjs` to Vercel and configure these environment variables in Vercel:
   - `GEMINI_API_KEY` (optional — falls back to grounded local orchestrator if omitted)
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `ALLOWED_ORIGINS=https://syedshahbuddin.github.io`
2. Add this CSP-safe meta tag inside `<head>` on your HTML pages (no inline `<script>` required):
   ```html
   <meta name="agent-endpoint" content="https://your-deployment.vercel.app/api/agent">
   ```

---

## Contact

- **Portfolio**: [https://syedshahbuddin.github.io/](https://syedshahbuddin.github.io/)
- **GitHub**: [https://github.com/Marburg7](https://github.com/Marburg7)
- **LinkedIn**: [Syed Shahabuddin](https://www.linkedin.com/in/syed-shahabuddin-1b209721b/)
- **Email**: [syedshafaiz76@gmail.com](mailto:syedshafaiz76@gmail.com)
