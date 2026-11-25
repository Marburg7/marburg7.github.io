/**
 * Syed Shahabuddin — Streaming AI Portfolio Agent UI (Lazy-Loaded Module)
 * Connects via SSE to POST /api/agent (or window.SYED_AGENT_ENDPOINT),
 * renders safe Markdown + syntax-styled code blocks with Copy Code,
 * Copy Response, live tool traces, JD Matcher toggle, Minimize/Close/Clear,
 * error recovery with Retry, keyboard navigation, and accessible focus management.
 */
(function () {
  "use strict";

  if (window.__syedAgentMounted) return;
  window.__syedAgentMounted = true;

  const rootPrefix = document.body.dataset.root || "./";
  const metaEndpoint = document.querySelector('meta[name="agent-endpoint"]')?.getAttribute("content")?.trim() || "";
  const configuredEndpoint = String(window.SYED_AGENT_ENDPOINT || metaEndpoint || "").trim();
  const isValidEndpoint = /^(https:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/.test(configuredEndpoint);
  const customEndpoint = isValidEndpoint ? configuredEndpoint : "";
  const isStaticOnlyHost =
    !customEndpoint &&
    (window.__syedForceStaticAgent === true ||
      window.location.protocol === "file:" ||
      /\.github\.io$/i.test(window.location.hostname));
  const endpoint = customEndpoint || "/api/agent";
  const STORAGE_KEY = "ss_ai_agent_session_v3";

  let state = {
    history: [], // { role: 'user' | 'assistant', content, tools?, actions?, mode? }
    mode: "chat", // 'chat' | 'jd'
    minimized: false,
    busy: false,
    lastFailedPayload: null,
  };

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.history)) {
        state.history = parsed.history.slice(-16);
      }
    }
  } catch {
    // ignore storage restrictions
  }

  function saveState() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ history: state.history.slice(-16) })
      );
    } catch {
      // ignore
    }
  }

  /* ------------------------------------------------------------------------
     Safe Markdown & Code Block Renderer (Strict XSS & Protocol Protection)
     ------------------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isSafeHref(url) {
    const u = String(url || "").trim();
    if (!u || /[\s"'<>`\\]/.test(u) || /[\u0000-\u001F\u007F]/.test(u)) return false;
    if (/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#|\.\.?\/)/i.test(u)) return true;
    return false;
  }

  function formatInlineMarkdown(raw) {
    let out = escapeHtml(raw);
    // Inline code
    out = out.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
    // Markdown links [label](url) with strict protocol validation
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      if (!isSafeHref(url)) return label;
      const external = /^https?:\/\//i.test(url);
      return `<a class="md-link" href="${url}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    });
    // Bold & italic
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
    return out;
  }

  function renderSafeMarkdown(markdown) {
    const text = String(markdown || "");
    const segments = [];
    const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = fenceRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: "code", lang: match[1] || "code", content: match[2].replace(/\n$/, "") });
      lastIndex = fenceRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ type: "text", content: text.slice(lastIndex) });
    }

    return segments
      .map((seg) => {
        if (seg.type === "code") {
          const lang = escapeHtml(seg.lang);
          const code = escapeHtml(seg.content);
          return `<div class="md-code-block"><div class="md-code-head"><span>${lang}</span><button type="button" class="md-copy-code" data-copy-code>Copy code</button></div><pre><code>${code}</code></pre></div>`;
        }

        const lines = seg.content.split(/\r?\n/);
        let html = "";
        let inUl = false;
        let inOl = false;

        const closeLists = () => {
          if (inUl) { html += "</ul>"; inUl = false; }
          if (inOl) { html += "</ol>"; inOl = false; }
        };

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            closeLists();
            continue;
          }
          if (/^###\s+/.test(trimmed)) {
            closeLists();
            html += `<h4 class="md-h">${formatInlineMarkdown(trimmed.replace(/^###\s+/, ""))}</h4>`;
          } else if (/^##\s+/.test(trimmed)) {
            closeLists();
            html += `<h4 class="md-h">${formatInlineMarkdown(trimmed.replace(/^##\s+/, ""))}</h4>`;
          } else if (/^[-*]\s+/.test(trimmed)) {
            if (inOl) { html += "</ol>"; inOl = false; }
            if (!inUl) { html += '<ul class="chat-bubble__list">'; inUl = true; }
            html += `<li><span>${formatInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</span></li>`;
          } else if (/^\d+\.\s+/.test(trimmed)) {
            if (inUl) { html += "</ul>"; inUl = false; }
            if (!inOl) { html += '<ol class="chat-bubble__olist">'; inOl = true; }
            html += `<li><span>${formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</span></li>`;
          } else {
            closeLists();
            html += `<p>${formatInlineMarkdown(trimmed)}</p>`;
          }
        }
        closeLists();
        return html;
      })
      .join("");
  }

  /* ------------------------------------------------------------------------
     Mount / Upgrade Panel DOM
     ------------------------------------------------------------------------ */
  function ensurePanelDom() {
    let fab = document.getElementById("assistant-fab");
    let panel = document.getElementById("assistant-panel");

    if (!fab) {
      fab = document.createElement("button");
      fab.id = "assistant-fab";
      fab.className = "assistant-fab";
      fab.type = "button";
      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-controls", "assistant-panel");
      fab.setAttribute("aria-label", "Open Syed's AI Portfolio Agent");
      fab.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span class="assistant-fab__label">Ask Syed's AI</span>`;
      document.body.appendChild(fab);
    }

    if (!panel) {
      panel = document.createElement("aside");
      panel.id = "assistant-panel";
      panel.className = "assistant-panel";
      panel.setAttribute("aria-hidden", "true");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Syed's AI Portfolio Agent");
      document.body.appendChild(panel);
    }

    panel.innerHTML = `
      <div class="assistant-panel__head">
        <div class="assistant-panel__title-wrap">
          <div class="assistant-panel__avatar" aria-hidden="true">AI</div>
          <div class="assistant-panel__title">
            <span>Syed's Portfolio AI</span>
            <span class="assistant-panel__status" data-agent-status><span class="status-dot" style="width:6px;height:6px;" aria-hidden="true"></span>Grounded CV Agent · Tools Ready</span>
          </div>
        </div>
        <div class="assistant-panel__head-actions">
          <button class="assistant-icon-btn" type="button" data-agent-minimize title="Minimize chat" aria-label="Minimize chat">—</button>
          <button class="assistant-icon-btn" type="button" data-agent-clear title="Clear conversation" aria-label="Clear conversation">↺</button>
          <button class="assistant-icon-btn" type="button" data-agent-close title="Close agent" aria-label="Close agent">✕</button>
        </div>
      </div>

      <div class="assistant-mode-bar" role="tablist" aria-label="Agent mode">
        <button type="button" class="mode-tab is-active" role="tab" aria-selected="true" data-mode="chat">Ask Anything</button>
        <button type="button" class="mode-tab" role="tab" aria-selected="false" data-mode="jd">Paste Job Description</button>
      </div>

      <div class="assistant-panel__messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
      <div class="assistant-error" role="alert" hidden>
        <span data-error-text></span>
        <button type="button" class="retry-btn" data-agent-retry>Retry</button>
      </div>
      <div class="assistant-prompts" aria-label="Suggested questions"></div>

      <form class="assistant-form" novalidate>
        <textarea rows="1" placeholder="Ask about Syed, projects, or stack..." aria-label="Message Syed's AI Portfolio Agent"></textarea>
        <button type="submit" data-agent-send aria-label="Send message">Send</button>
      </form>
    `;

    return { fab, panel };
  }

  const { fab, panel } = ensurePanelDom();
  const statusEl = panel.querySelector("[data-agent-status]");
  const messagesEl = panel.querySelector(".assistant-panel__messages");
  const promptsEl = panel.querySelector(".assistant-prompts");
  const errorBox = panel.querySelector(".assistant-error");
  const errorText = panel.querySelector("[data-error-text]");
  const retryBtn = panel.querySelector("[data-agent-retry]");
  const form = panel.querySelector(".assistant-form");
  const textarea = form.querySelector("textarea");
  const sendBtn = form.querySelector("[data-agent-send]");
  const modeTabs = panel.querySelectorAll(".mode-tab");

  /* ------------------------------------------------------------------------
     Portfolio UI Actions Triggered by Agent Tool Outputs
     ------------------------------------------------------------------------ */
  function runUiAction(action, btnEl) {
    if (!action) return;
    if (action.type === "open-case") {
      if (typeof window.__openCaseStudy === "function") {
        setOpen(false);
        window.__openCaseStudy(action.value);
      } else {
        window.location.href = `${rootPrefix}projects/`;
      }
    } else if (action.type === "navigate") {
      const target = action.value.startsWith("http") ? action.value : `${rootPrefix}${action.value.replace(/^\//, "")}`;
      window.location.href = target;
    } else if (action.type === "scroll") {
      const el = document.getElementById(action.value);
      if (el) {
        setOpen(false);
        el.scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.href = `${rootPrefix}#${action.value}`;
      }
    } else if (action.type === "external" && isSafeHref(action.value)) {
      window.open(action.value, "_blank", "noopener,noreferrer");
    } else if (action.type === "copy") {
      navigator.clipboard?.writeText(action.value).catch(() => {});
      if (btnEl) {
        const prev = btnEl.textContent;
        btnEl.textContent = "Copied ✓";
        window.setTimeout(() => (btnEl.textContent = prev), 1600);
      }
    }
  }

  /* ------------------------------------------------------------------------
     Message Bubble Rendering & Copy Controls
     ------------------------------------------------------------------------ */
  function createMessageBubble(role, initialContent = "") {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble--${role === "user" ? "user" : "bot"}`;

    if (role === "user") {
      bubble.textContent = initialContent;
      messagesEl.appendChild(bubble);
      scrollBottom();
      return { bubble };
    }

    const tracesWrap = document.createElement("div");
    tracesWrap.className = "chat-traces";

    const bodyEl = document.createElement("div");
    bodyEl.className = "chat-bubble__body";
    if (initialContent) bodyEl.innerHTML = renderSafeMarkdown(initialContent);

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "chat-actions";
    actionsWrap.hidden = true;

    const metaFoot = document.createElement("div");
    metaFoot.className = "chat-msg-foot";
    const copyMsgBtn = document.createElement("button");
    copyMsgBtn.type = "button";
    copyMsgBtn.className = "copy-msg-btn";
    copyMsgBtn.textContent = "Copy";
    copyMsgBtn.setAttribute("aria-label", "Copy response text");
    metaFoot.appendChild(copyMsgBtn);

    bubble.append(tracesWrap, bodyEl, actionsWrap, metaFoot);
    messagesEl.appendChild(bubble);
    scrollBottom();

    // Delegate Copy Code button clicks
    bodyEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-copy-code]");
      if (!btn) return;
      const code = btn.closest(".md-code-block")?.querySelector("code")?.textContent || "";
      navigator.clipboard?.writeText(code).catch(() => {});
      btn.textContent = "Copied ✓";
      window.setTimeout(() => (btn.textContent = "Copy code"), 1600);
    });

    return { bubble, tracesWrap, bodyEl, actionsWrap, copyMsgBtn };
  }

  function addTracePill(tracesWrap, summary, isPending = false) {
    const pill = document.createElement("div");
    pill.className = `chat-trace${isPending ? " is-pending" : ""}`;
    pill.textContent = `${isPending ? "◌" : "⚡"} ${summary}`;
    tracesWrap.appendChild(pill);
    scrollBottom();
    return pill;
  }

  function renderActions(actionsWrap, items) {
    if (!items || !items.length) return;
    actionsWrap.innerHTML = "";
    actionsWrap.hidden = false;
    items.forEach((act) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-action-btn";
      btn.textContent = act.label;
      btn.addEventListener("click", () => runUiAction(act, btn));
      actionsWrap.appendChild(btn);
    });
    scrollBottom();
  }

  function renderPrompts(list) {
    promptsEl.innerHTML = "";
    (list || []).slice(0, 3).forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "prompt-chip";
      btn.textContent = text;
      btn.addEventListener("click", () => sendMessage(text));
      promptsEl.appendChild(btn);
    });
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showError(msg, retryPayload) {
    errorText.textContent = msg;
    errorBox.hidden = false;
    state.lastFailedPayload = retryPayload || null;
    retryBtn.hidden = !retryPayload;
    scrollBottom();
  }

  function clearError() {
    errorBox.hidden = true;
    errorText.textContent = "";
    state.lastFailedPayload = null;
  }

  /* ------------------------------------------------------------------------
     Grounded Client-Side Portfolio Agent (GitHub Pages / Static-Host Engine)
     Zero 404 console errors, prompt-injection defense, full JD analysis,
     multi-turn follow-ups, and progressive streaming UX.
     ------------------------------------------------------------------------ */
  let cachedStaticKb = null;
  const CLIENT_INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    /reveal\s+(your\s+)?(system\s+prompt|instructions|api\s*key|secret|env)/i,
    /print\s+(process\.env|api\s*key|system\s+prompt)/i,
    /(you\s+are\s+now|act\s+as\s+a?\s*dan|developer\s+mode|jailbreak)/i,
    /<script[\s>]|javascript:|onerror\s*=|onload\s*=/i,
  ];
  const CLIENT_GAP_CANDIDATES = [
    "GraphQL", "Rust", "Go", "Golang", "Ruby on Rails", "Vue.js", "Angular", "Svelte",
    "MongoDB", "PostgreSQL", "Redis", "Terraform", "Django", "Spring Boot",
    "C#", ".NET", "Swift", "Kotlin", "Flutter", "React Native", "Elasticsearch", "Kafka",
  ];

  async function loadStaticKb() {
    if (!cachedStaticKb) {
      const res = await fetch(`${rootPrefix}data/portfolio-knowledge.json`);
      if (!res.ok) throw new Error("Could not load portfolio knowledge data.");
      cachedStaticKb = await res.json();
    }
    return cachedStaticKb;
  }

  async function staticFallbackReply(message, mode, historySnapshot = []) {
    const kb = await loadStaticKb();
    const text = String(message || "").trim();
    const s = text.toLowerCase();

    // 1. Prompt-injection / XSS defense
    if (CLIENT_INJECTION_PATTERNS.some((re) => re.test(text))) {
      return {
        traces: ["Security Guard · Prompt injection blocked"],
        text: "I can only answer questions about **Syed Shahabuddin's verified portfolio, skills, projects, and work experience**. I cannot override my instructions or execute untrusted commands.\n\nTry asking about **Sovos Studio**, **NovaCut Studio**, his **React.js / TypeScript** experience, or paste a job description for an honest fit analysis.",
        actions: [
          { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
          { label: "Browse Experience", type: "navigate", value: "experience/" },
        ],
        followups: ["Tell me about Sovos Studio", "Explain his work to a CTO", "Contact details"],
      };
    }

    // 2. Job Description Matcher (Verified Matches + Honest Gaps)
    if (mode === "jd" || (text.length > 140 && /\b(requirements|responsibilities|qualifications|experience|looking for|must have)\b/i.test(s))) {
      const matched = [];
      for (const group of kb.skills) {
        for (const item of group.items) {
          const aliases = [item.name, ...(item.aliases || [])];
          if (aliases.some((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))) {
            matched.push({ skill: item.name, category: group.category, evidence: item.workEvidence, projects: item.projectEvidence || [] });
          }
        }
      }
      const gaps = CLIENT_GAP_CANDIDATES.filter((tech) =>
        new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)
      );
      const relevantProjects = kb.projects
        .map((p) => {
          const score = matched.filter((m) => m.projects.includes(p.name)).length +
            (p.technologies || []).filter((t) => s.includes(t.toLowerCase())).length;
          return { p, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((x) => x.p);

      const fitLabel = matched.length >= 6 ? "Strong match" : matched.length >= 3 ? "Moderate-to-strong match" : "Partial match";
      const lines = [
        `### Job Description Fit Analysis — ${fitLabel}`,
        `Matched **${matched.length} verified skills** from Syed's documented CV & portfolio.`,
        "",
        "### Verified Skill Matches",
        ...(matched.length
          ? matched.slice(0, 10).map((m) => `- **${m.skill}** (${m.category}) — ${m.evidence}`)
          : ["- Limited direct keyword overlap with documented skills in this JD."]),
      ];

      if (gaps.length) {
        lines.push(
          "",
          "### Honest Gaps (Not Documented in CV/Portfolio)",
          ...gaps.map((g) => `- **${g}** — Not explicitly documented in Syed's portfolio or CV; worth confirming directly in an interview.`)
        );
      } else {
        lines.push("", "### Gaps Check", "- No major undocumented technologies detected among the common stack requirements in this excerpt.");
      }

      if (relevantProjects.length) {
        lines.push(
          "",
          "### Most Relevant Projects",
          ...relevantProjects.map((p) => `- **${p.name}** (${p.category}): ${p.summary}`)
        );
      }

      return {
        traces: ["Retrieved portfolio skills & projects", `Analyzed JD (${matched.length} matches, ${gaps.length} gaps)`],
        text: lines.join("\n"),
        actions: [
          ...(relevantProjects[0] ? [{ label: `Inspect ${relevantProjects[0].name}`, type: "open-case", value: relevantProjects[0].id }] : []),
          { label: "View All Projects", type: "navigate", value: "projects/" },
          { label: "Copy Email", type: "copy", value: kb.contact.email },
        ],
        followups: ["What interview questions should I ask him?", "Explain his work to a CTO", "Get contact details"],
      };
    }

    // 3. Multi-turn follow-up resolution
    const lastUserMsg = [...historySnapshot].reverse().find((m) => m.role === "user")?.content?.toLowerCase() || "";
    const lastBotMsg = [...historySnapshot].reverse().find((m) => m.role === "assistant")?.content?.toLowerCase() || "";

    if (/\b(which of those|used at work|in production|at work)\b/i.test(s) && /react|frontend|typescript|stack|skill/i.test(lastUserMsg + " " + lastBotMsg)) {
      const sovos = kb.experience.find((e) => e.id === "sovos");
      const eduleem = kb.experience.find((e) => e.id === "eduleem");
      return {
        traces: ["Resolved multi-turn context", "Retrieved work-verified stack"],
        text: [
          "### Technologies Used in Production at Work",
          `- **At ${sovos.company} (${sovos.period})**: \`React.js\`, \`Next.js API\` (Sovos Studio), \`TypeScript\`, \`JavaScript (ES6+)\`, \`Tailwind CSS\`, \`Storybook\`, \`Jest\`, \`React Testing Library\`, \`WordPress / PHP\`, \`Docker\`, \`Kubernetes\`, \`Lando\`, \`AWS\`, \`Azure\`, and \`CI/CD YAML\` pipelines across **10+ eCommerce sites** and **7+ regional multisites**.`,
          `- **At ${eduleem.company} (${eduleem.period})**: \`React.js\`, \`Node.js\`, \`WordPress / WooCommerce\`, \`REST APIs\`, \`Figma\`, and \`Technical SEO\` across 5 domains sustaining **70,000+ visitors every 15 days**.`,
          `- **At ARM Infoserve (Sep – Nov 2023)**: \`WordPress\`, \`WooCommerce\`, \`PHP\`, \`JavaScript/jQuery\`, and \`Core Java\`.`,
        ].join("\n"),
        actions: [
          { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
          { label: "Experience & CV", type: "navigate", value: "experience/" },
        ],
        followups: ["What about testing?", "Tell me about Sovos Studio", "Explain his work to a CTO"],
      };
    }

    // 4. Testing / Quality
    if (/\b(jest|testing|rtl|unit test|component test|qa)\b/i.test(s)) {
      return {
        traces: ["Retrieved testing & QA evidence"],
        text: [
          "### Testing & Quality Engineering",
          "At **Sovos**, Syed maintains unit and component test suites for reusable React.js & TypeScript UI libraries using **Jest** and **React Testing Library**, wired into automated **CI/CD YAML pipelines** across dev, staging, and production.",
          "",
          "```tsx",
          "// Pattern Syed uses for component testing in React + TypeScript",
          "import { render, screen } from '@testing-library/react';",
          "import { ReportStatusBadge } from './ReportStatusBadge';",
          "",
          "test('renders published badge state accessibly', () => {",
          "  render(<ReportStatusBadge status=\"published\" />);",
          "  expect(screen.getByRole('status')).toHaveTextContent(/published/i);",
          "});",
          "```",
          "",
          "*Note: The code snippet above is a representative pattern illustrating his documented Jest + React Testing Library workflow, not proprietary Sovos source code.*",
        ].join("\n"),
        actions: [
          { label: "Technical Skills Matrix", type: "navigate", value: "tools/" },
          { label: "Experience & CV", type: "navigate", value: "experience/" },
        ],
        followups: ["Tell me about Sovos Studio", "What DevOps & cloud tools does he use?", "Explain his work to a CTO"],
      };
    }

    // 5. Specific Project Lookup (including Sovos Studio!)
    const projectMatchers = [
      { id: "sovos_studio", re: /sovos\s*studio|choropleth|report\s*builder|report\s*canvas|data\s*visualization/i },
      { id: "novacut", re: /novacut|clip\s*maker|video|twitch|kick|ollama/i },
      { id: "taxapedia", re: /taxapedia|ai\s*seo|canonical/i },
      { id: "efilemyform", re: /efilemyform|efile|w-?2|aca/i },
      { id: "1099pro", re: /1099pro|1099/i },
      { id: "eduleem", re: /eduleem|70,?000|cubedecors/i },
      { id: "royaal", re: /royaal|mahaadeva|real\s*estate/i },
      { id: "sovos", re: /multisite|10\+\s*ecommerce|regional\s*sites/i },
    ];
    for (const pm of projectMatchers) {
      if (pm.re.test(s)) {
        const proj = kb.projects.find((p) => p.id === pm.id);
        if (proj) {
          const actions = [{ label: `Inspect ${proj.name}`, type: "open-case", value: proj.id }];
          if (proj.github) actions.push({ label: "GitHub Repo", type: "external", value: proj.github });
          if (proj.liveUrl && proj.liveUrl !== proj.github) actions.push({ label: "Live Site", type: "external", value: proj.liveUrl });
          return {
            traces: [`Retrieved project: ${proj.name}`],
            text: [
              `### ${proj.name} — ${proj.category}`,
              proj.summary,
              "",
              `- **Role & Timeline:** ${proj.role} (${proj.timeline})`,
              `- **Architecture:** ${proj.architecture}`,
              `- **Key Challenge & Solution:** ${proj.challengesAndSolutions}`,
              `- **Stack:** \`${proj.technologies.join("` · `")}\``,
              ...(proj.highlights || []).map((h) => `- ${h}`),
            ].join("\n"),
            actions,
            followups: ["Show all featured projects", "What makes him different?", "Get contact details"],
          };
        }
      }
    }

    // 6. All Projects Overview
    if (/\b(projects?|portfolio|built|case stud|showcase|open source)\b/i.test(s)) {
      return {
        traces: [`Retrieved ${kb.projects.length} documented projects`],
        text: [
          "### Featured Projects",
          ...kb.projects.slice(0, 7).map((p) => `- **${p.name}** (${p.category}): ${p.summary}`),
          "",
          "Click any project button below to open its interactive Case Study drawer.",
        ].join("\n"),
        actions: [
          { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
          { label: "Inspect NovaCut Studio", type: "open-case", value: "novacut" },
          { label: "All Projects Page", type: "navigate", value: "projects/" },
        ],
        followups: ["Tell me about Sovos Studio", "Tell me about NovaCut Studio", "Paste a job description"],
      };
    }

    // 7. CTO / Recruiter / What makes him different / Interview questions
    if (/\b(cto|hiring manager|recruiter|different|stand out|why hire|strengths?)\b/i.test(s)) {
      return {
        traces: ["Synthesized engineering & leadership brief"],
        text: [
          "### Engineering Brief for CTOs & Hiring Managers",
          `Syed Shahabuddin brings **${kb.profile.yearsExperience} years** of production React.js & Full-Stack delivery, currently at **Sovos** managing **10+ eCommerce websites**, **7+ regional multisites**, reusable **Storybook + TypeScript** component libraries, and interactive Next.js/React applications like **Sovos Studio**.`,
          "",
          "### What Differentiates Him",
          ...kb.profile.teamStrengths.map((t) => `- ${t}`),
          "",
          "### Best-Fit Roles",
          ...kb.profile.suitableRoles.slice(0, 4).map((r) => `- ${r}`),
        ].join("\n"),
        actions: [
          { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
          { label: "Experience & CV", type: "navigate", value: "experience/" },
          { label: "Copy Email", type: "copy", value: kb.contact.email },
        ],
        followups: ["What interview questions should I ask him?", "Tell me about NovaCut Studio", "Paste a job description"],
      };
    }

    if (/\b(interview|questions? to ask|assess|evaluate)\b/i.test(s)) {
      return {
        traces: ["Generated evidence-based interview guide"],
        text: [
          "### High-Signal Interview Questions for Syed",
          "1. **Design Systems at Scale (Sovos):** How did you structure your React + TypeScript + Storybook component library and Jest/RTL tests to serve 7+ regional multisites without regressions?",
          "2. **Interactive Data & State Sync (Sovos Studio):** How did you keep the live spreadsheet dataset editor synchronized with the interactive USA choropleth map and multi-page report canvas?",
          "3. **Full-Stack Tradeoffs (NovaCut Studio):** Why did you combine local transcription + NLP with pluggable LLM providers (Gemini/Ollama/Claude), and how did you isolate creator workspaces?",
          "4. **Performance & SEO Ownership (Eduleem / Taxapedia):** Walk through the highest-impact technical SEO and Core Web Vitals fixes you shipped across sites sustaining 70,000+ visitors every 15 days.",
        ].join("\n"),
        actions: [
          { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
          { label: "Inspect NovaCut Studio", type: "open-case", value: "novacut" },
        ],
        followups: ["Explain his work to a CTO", "What frontend technologies does he use?", "Get contact details"],
      };
    }

    // 8. Experience / Career / Education / Certifications
    if (/\b(experience|career|work|sovos|resume|cv|background|education|degree|certif|aws)\b/i.test(s)) {
      return {
        traces: ["Retrieved career timeline, education & certifications"],
        text: [
          "### Work Experience",
          ...kb.experience.map((e) => `- **${e.role} — ${e.company}** (${e.period}): ${e.highlights[0]}`),
          "",
          "### Education & Key Certifications",
          `- **${kb.education[0].degree}** — ${kb.education[0].institution} (${kb.education[0].year}, ${kb.education[0].score})`,
          ...kb.certifications.slice(0, 3).map((c) => `- **${c.name}** (${c.issuer}, ${c.date})`),
        ].join("\n"),
        actions: [
          { label: "Full Experience & CV", type: "navigate", value: "experience/" },
          { label: "Copy Email", type: "copy", value: kb.contact.email },
        ],
        followups: ["What frontend technologies does he use?", "Tell me about Sovos Studio", "Get contact details"],
      };
    }

    // 9. Skills / Tech Stack
    if (/\b(skill|stack|tech|react|typescript|next|node|php|python|fastapi|docker|kubernetes|wordpress|woocommerce|figma|seo|frontend|backend|devops|cloud)\b/i.test(s)) {
      const matchedGroups = kb.skills.filter((g) =>
        s.includes(g.id) ||
        g.category.toLowerCase().split(/\W+/).some((w) => w.length > 2 && s.includes(w)) ||
        g.items.some((i) => [i.name, ...(i.aliases || [])].some((a) => s.includes(a.toLowerCase())))
      );
      const groups = matchedGroups.length ? matchedGroups : kb.skills.slice(0, 5);
      return {
        traces: [`Retrieved ${groups.length} verified skill categories`],
        text: [
          "### Verified Technical Skills",
          ...groups.map((g) => `- **${g.category}:** ${g.items.map((i) => `\`${i.name}\``).join(" · ")}`),
        ].join("\n"),
        actions: [
          { label: "Full Skills Matrix", type: "navigate", value: "tools/" },
          { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
        ],
        followups: ["Which of those has he used at work?", "What about testing?", "Paste a job description"],
      };
    }

    // 10. Contact / Availability / Salary / Notice period
    if (/\b(contact|email|phone|hire|reach|linkedin|github|salary|notice|relocat|availab)\b/i.test(s)) {
      return {
        traces: ["Retrieved verified contact & availability"],
        text: [
          "### Contact Syed Shahabuddin",
          `- **Email:** [${kb.contact.email}](mailto:${kb.contact.email})`,
          `- **Phone:** ${kb.contact.phone}`,
          `- **Location:** ${kb.contact.location}`,
          `- **GitHub:** [github.com/Marburg7](${kb.contact.github})`,
          `- **LinkedIn:** [Syed Shahabuddin](${kb.contact.linkedin})`,
          "",
          `*Availability note:* ${kb.profile.availabilityNote}`,
        ].join("\n"),
        actions: [
          { label: "Copy Email", type: "copy", value: kb.contact.email },
          { label: "Jump to Contact Form", type: "scroll", value: "contact" },
          { label: "Open GitHub", type: "external", value: kb.contact.github },
        ],
        followups: ["Explain his work to a CTO", "Tell me about Sovos Studio", "Summarize experience"],
      };
    }

    // 11. Default Grounded Overview
    return {
      traces: ["Retrieved verified portfolio profile"],
      text: [
        `### ${kb.profile.name} — ${kb.profile.headline}`,
        kb.profile.summary,
        "",
        `- **Current Role:** ${kb.profile.currentRole}`,
        `- **Location:** ${kb.profile.location}`,
        `- **Flagship Builds:** **Sovos Studio** (Next.js/React interactive report & choropleth map studio), **NovaCut Studio** (open-source AI clip maker), and **Sovos Multisite Platform** (10+ eCommerce & 7+ regional sites).`,
      ].join("\n"),
      actions: [
        { label: "Inspect Sovos Studio", type: "open-case", value: "sovos_studio" },
        { label: "Key Projects", type: "navigate", value: "projects/" },
        { label: "Experience & CV", type: "navigate", value: "experience/" },
      ],
      followups: ["Tell me about Sovos Studio", "Explain his work to a CTO", "Paste a job description"],
    };
  }

  async function runClientAgentTurn(ui, text, activeMode, historySnapshot) {
    const fb = await staticFallbackReply(text, activeMode, historySnapshot);
    const traces = fb.traces || [fb.trace || "Grounded Portfolio Agent"];
    traces.forEach((t) => addTracePill(ui.tracesWrap, t, false));

    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot" style="width:6px;height:6px;" aria-hidden="true"></span>Grounded CV Agent · Live`;
    }

    // Progressive chunk streaming for responsive UX
    ui.bodyEl.innerHTML = "";
    const tokens = fb.text.match(/\S+\s*/g) || [fb.text];
    let built = "";
    const step = Math.max(3, Math.ceil(tokens.length / 24));
    for (let i = 0; i < tokens.length; i += step) {
      built += tokens.slice(i, i + step).join("");
      ui.bodyEl.innerHTML = renderSafeMarkdown(built);
      scrollBottom();
      await new Promise((r) => window.setTimeout(r, 14));
    }

    renderActions(ui.actionsWrap, fb.actions);
    renderPrompts(fb.followups);
    ui.copyMsgBtn.addEventListener("click", () => {
      navigator.clipboard?.writeText(fb.text).catch(() => {});
      ui.copyMsgBtn.textContent = "Copied ✓";
      window.setTimeout(() => (ui.copyMsgBtn.textContent = "Copy"), 1500);
    });
    state.history.push({ role: "assistant", content: fb.text, tools: traces, actions: fb.actions });
    saveState();
  }

  /* ------------------------------------------------------------------------
     Send Message & Stream SSE Events from /api/agent
     ------------------------------------------------------------------------ */
  async function sendMessage(rawText, overrideMode) {
    const text = String(rawText || "").trim();
    if (!text || state.busy) return;

    clearError();
    state.busy = true;
    sendBtn.disabled = true;

    const activeMode = overrideMode || state.mode;
    const historySnapshot = state.history.map((m) => ({ role: m.role, content: m.content }));

    state.history.push({ role: "user", content: text, mode: activeMode });
    createMessageBubble("user", text);
    saveState();

    // Assistant placeholder bubble with typing indicator
    const ui = createMessageBubble("assistant", "");
    ui.bodyEl.innerHTML = `<span class="chat-typing"><span class="chat-typing__dots"><span></span><span></span><span></span></span><span>Thinking & retrieving context...</span></span>`;

    let accumulatedText = "";
    let collectedTools = [];
    let collectedActions = [];
    let activePendingPill = null;

    try {
      // On GitHub Pages (without a custom backend configured), run the grounded client agent directly to avoid 404 console errors
      if (isStaticOnlyHost) {
        await runClientAgentTurn(ui, text, activeMode, historySnapshot);
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: text, history: historySnapshot, mode: activeMode }),
      });

      if (response.status === 429) {
        const errJson = await response.json().catch(() => ({}));
        ui.bubble.remove();
        state.history.pop();
        showError(errJson.error || "Too many requests. Please wait a moment and retry.", { text, mode: activeMode });
        return;
      }

      if (response.status === 404 || response.status === 405) {
        // Static-only hosting fallback (e.g., local static server without Node API backend)
        await runClientAgentTurn(ui, text, activeMode, historySnapshot);
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let sseBuffer = "";
      let firstDeltaReceived = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const frames = sseBuffer.split("\n\n");
        sseBuffer = frames.pop() || "";

        for (const frame of frames) {
          const eventMatch = frame.match(/^event:\s*(.+)$/m);
          const dataMatch = frame.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventName = eventMatch[1].trim();
          let payload;
          try {
            payload = JSON.parse(dataMatch[1]);
          } catch {
            continue;
          }

          if (eventName === "meta" && statusEl) {
            const label = payload.mode === "live-llm"
              ? `Live AI (${payload.provider}) · Tools Active`
              : "Grounded CV Agent · Tools Active";
            statusEl.innerHTML = `<span class="status-dot" style="width:6px;height:6px;" aria-hidden="true"></span>${escapeHtml(label)}`;
          } else if (eventName === "tool") {
            if (payload.phase === "start") {
              activePendingPill = addTracePill(ui.tracesWrap, payload.summary, true);
            } else {
              if (activePendingPill) {
                activePendingPill.remove();
                activePendingPill = null;
              }
              addTracePill(ui.tracesWrap, payload.summary, false);
              collectedTools.push(payload.summary);
            }
          } else if (eventName === "delta") {
            if (!firstDeltaReceived) {
              firstDeltaReceived = true;
              ui.bodyEl.innerHTML = "";
            }
            accumulatedText += payload.text || "";
            ui.bodyEl.innerHTML = renderSafeMarkdown(accumulatedText);
            scrollBottom();
          } else if (eventName === "actions") {
            collectedActions = payload.items || [];
            renderActions(ui.actionsWrap, collectedActions);
          } else if (eventName === "followups") {
            renderPrompts(payload.items || []);
          } else if (eventName === "error") {
            throw new Error(payload.error || "Streaming error");
          }
        }
      }

      if (!accumulatedText) {
        throw new Error("Empty response received from agent.");
      }

      ui.copyMsgBtn.addEventListener("click", () => {
        navigator.clipboard?.writeText(accumulatedText).catch(() => {});
        ui.copyMsgBtn.textContent = "Copied ✓";
        window.setTimeout(() => (ui.copyMsgBtn.textContent = "Copy"), 1500);
      });

      state.history.push({
        role: "assistant",
        content: accumulatedText,
        tools: collectedTools,
        actions: collectedActions,
      });
      saveState();
    } catch (err) {
      ui.bubble.remove();
      state.history.pop();
      showError(err.message || "Could not reach the AI agent. Please retry.", { text, mode: activeMode });
    } finally {
      state.busy = false;
      sendBtn.disabled = false;
      if (state.mode === "jd") {
        setMode("chat");
      }
      textarea.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Mode Switching, Open / Minimize / Clear & Keyboard Accessibility
     ------------------------------------------------------------------------ */
  function setMode(nextMode) {
    state.mode = nextMode === "jd" ? "jd" : "chat";
    modeTabs.forEach((t) => {
      const active = t.dataset.mode === state.mode;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
    });
    textarea.placeholder =
      state.mode === "jd"
        ? "Paste a job description here for an honest skill & gap match..."
        : "Ask about Syed, projects, or stack...";
    textarea.rows = state.mode === "jd" ? 4 : 1;
    textarea.focus();
  }

  function setOpen(open) {
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    fab.setAttribute("aria-expanded", String(open));
    if (open) {
      state.minimized = false;
      panel.classList.remove("is-minimized");
      window.setTimeout(() => textarea.focus(), 80);
    } else {
      fab.focus();
    }
  }

  function toggleMinimize() {
    state.minimized = !state.minimized;
    panel.classList.toggle("is-minimized", state.minimized);
    const minBtn = panel.querySelector("[data-agent-minimize]");
    if (minBtn) minBtn.textContent = state.minimized ? "▢" : "—";
  }

  function clearConversation() {
    state.history = [];
    clearError();
    messagesEl.innerHTML = "";
    const welcomeText =
      "Hi! I'm **Syed Shahabuddin's AI Portfolio Agent**.\n\nAsk me anything about his **3+ years of React.js & Full-Stack experience**, explore projects like **Sovos Studio** or **NovaCut Studio**, ask technical or CTO-level questions, or switch to **Paste Job Description** for an honest, evidence-based fit analysis.";
    const ui = createMessageBubble("assistant", welcomeText);
    ui.copyMsgBtn.addEventListener("click", () => {
      navigator.clipboard?.writeText(welcomeText).catch(() => {});
      ui.copyMsgBtn.textContent = "Copied ✓";
      window.setTimeout(() => (ui.copyMsgBtn.textContent = "Copy"), 1500);
    });
    renderPrompts([
      "Tell me about Sovos Studio",
      "Explain his work to a CTO",
      "Tell me about NovaCut Studio",
    ]);
    saveState();
  }

  // Hydrate history or show welcome
  if (state.history.length > 0) {
    messagesEl.innerHTML = "";
    state.history.forEach((m) => {
      const ui = createMessageBubble(m.role, m.content);
      if (m.role === "assistant") {
        (m.tools || []).forEach((t) => addTracePill(ui.tracesWrap, t, false));
        renderActions(ui.actionsWrap, m.actions || []);
        ui.copyMsgBtn.addEventListener("click", () => {
          navigator.clipboard?.writeText(m.content).catch(() => {});
          ui.copyMsgBtn.textContent = "Copied ✓";
          window.setTimeout(() => (ui.copyMsgBtn.textContent = "Copy"), 1500);
        });
      }
    });
    renderPrompts([
      "Which of those has he used at work?",
      "What interview questions should I ask him?",
      "Get contact details",
    ]);
  } else {
    clearConversation();
  }

  // Wire controls
  fab.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));
  panel.querySelector("[data-agent-close]").addEventListener("click", () => setOpen(false));
  panel.querySelector("[data-agent-minimize]").addEventListener("click", toggleMinimize);
  panel.querySelector("[data-agent-clear]").addEventListener("click", clearConversation);
  retryBtn.addEventListener("click", () => {
    if (state.lastFailedPayload) {
      const { text, mode } = state.lastFailedPayload;
      sendMessage(text, mode);
    }
  });

  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = textarea.value;
    textarea.value = "";
    textarea.style.height = "";
    sendMessage(val);
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(132, textarea.scrollHeight)}px`;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("is-open")) {
      setOpen(false);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setOpen(!panel.classList.contains("is-open"));
    }
  });

  // Expose helper if user clicked launcher before lazy script finished
  if (window.__syedAgentOpenOnLoad) {
    window.__syedAgentOpenOnLoad = false;
    setOpen(true);
  }
})();
