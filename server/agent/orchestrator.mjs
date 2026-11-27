/**
 * Multi-Step Tool-Calling & Streaming Agent Orchestrator
 *
 * Execution priority:
 *  1. Prompt-injection guard (blocks override / secret-exfiltration attempts safely)
 *  2. Selective knowledge retrieval (top-K relevant CV/portfolio chunks)
 *  3. Live LLM with controlled Tool Calling if GEMINI_API_KEY is configured
 *  4. Grounded Deterministic Tool-Calling Orchestrator if no API key is configured
 *     (transparently labeled mode: "local-orchestrator", still executing real tools & SSE streaming)
 */
import { loadKnowledge, retrieveContext } from "./knowledge.mjs";
import { TOOL_DECLARATIONS, executeTool } from "./tools.mjs";
import { buildSystemPrompt } from "./prompt.mjs";
import { detectPromptInjection } from "./security.mjs";

export function getActiveProviderInfo() {
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      mode: "live-llm",
    };
  }
  return {
    provider: "local-grounded",
    model: "deterministic-cv-orchestrator-v2",
    mode: "local-orchestrator",
  };
}

/* --- Gemini Multi-Turn Tool-Calling Integration --- */
async function runGeminiAgent({ message, history, systemPrompt, emit }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const toolsPayload = [
    {
      functionDeclarations: TOOL_DECLARATIONS.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];

  const collectedActions = [];
  let finalText = "";

  for (let hop = 0; hop < 3; hop++) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: toolsPayload,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1100,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`Gemini API HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const fnCalls = parts.filter((p) => p.functionCall);

    if (fnCalls.length === 0) {
      finalText = parts.map((p) => p.text || "").join("").trim();
      break;
    }

    contents.push({ role: "model", parts });
    const responseParts = [];

    for (const part of fnCalls) {
      const { name, args } = part.functionCall;
      emit("tool", { phase: "start", tool: name, summary: `Running ${name}...` });
      const result = executeTool(name, args || {});
      emit("tool", { phase: "done", tool: name, summary: result.summary, ok: result.ok });
      if (result.uiActions?.length) collectedActions.push(...result.uiActions);
      responseParts.push({
        functionResponse: {
          name,
          response: { result: result.data },
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  return { text: finalText, actions: dedupeActions(collectedActions) };
}

/* --- Grounded Local Tool-Calling Orchestrator (No External API Key Needed) --- */
function isJobDescriptionInput(message, mode) {
  if (mode === "jd") return true;
  const s = message.toLowerCase();
  const jdSignals = [
    /\b(job description|jd|responsibilities|requirements|qualifications|what you('ll| will) do|must have|nice to have|analyze this job|match.*job|fit.*role|gaps? between)\b/i,
  ];
  if (jdSignals.some((re) => re.test(message)) && message.length > 75) return true;
  if (message.length > 260 && /\b(years|experience|react|typescript|developer|engineer|skills)\b/i.test(s)) return true;
  return false;
}

function runLocalGroundedOrchestrator({ message, history, mode, emit }) {
  const kb = loadKnowledge();
  const s = message.toLowerCase();
  const prevAssistant = [...history].reverse().find((m) => m.role === "assistant")?.content || "";
  const prevUser = [...history].reverse().find((m) => m.role === "user")?.content || "";
  const actions = [];
  let followups = [];

  const callTool = (name, args = {}) => {
    emit("tool", { phase: "start", tool: name, summary: `Executing ${name}...` });
    const result = executeTool(name, args);
    emit("tool", { phase: "done", tool: name, summary: result.summary, ok: result.ok });
    if (result.uiActions?.length) actions.push(...result.uiActions);
    return result;
  };

  // 1. Dedicated Job Description Analysis Mode / Intent
  if (isJobDescriptionInput(message, mode)) {
    const res = callTool("analyze_job_description", { jobDescription: message });
    const d = res.data;
    if (d.error) {
      return { text: d.error, actions: [], followups: ["Paste a React/Full-Stack JD", "What roles fit Syed best?"] };
    }

    const lines = [
      `### Job Description Fit Analysis`,
      `**Evidence-Based Assessment:** **${d.fitAssessment}** (${d.matchedCount} documented skill matches, ${d.gapCount} noted gaps)`,
      "",
      `**Experience Alignment:** ${d.experienceCheck.documented}.${d.experienceCheck.gapNote ? ` ${d.experienceCheck.gapNote}` : ""}`,
    ];

    if (d.matchedSkills.length) {
      lines.push("", "**Verified Matching Skills & Evidence:**");
      for (const m of d.matchedSkills.slice(0, 7)) {
        lines.push(`- **${m.skill}** (*${m.category}*): ${m.workEvidence}.`);
      }
    }

    if (d.relevantProjects.length) {
      lines.push("", "**Most Relevant Projects:**");
      for (const p of d.relevantProjects) {
        lines.push(`- **${p.name}** (${p.role}): ${p.reason}`);
      }
    }

    lines.push("", "**Honest Gap Assessment:**");
    if (d.potentialGaps.length) {
      for (const g of d.potentialGaps) {
        lines.push(`- **${g.requirement}:** ${g.status}.`);
      }
    } else {
      lines.push("- No major unaddressed technology gaps were detected among the requirements stated in this text. Clarifying role seniority, domain depth, and notice period directly with Syed is still recommended.");
    }

    lines.push(
      "",
      "**Recruiter Summary:** Based strictly on Syed's documented portfolio and CV, he brings 3+ years of full-stack React.js/TypeScript/WordPress/Cloud experience with tested UI component systems and high-traffic delivery. Reach him at **syedshafaiz76@gmail.com** to explore role alignment."
    );

    return {
      text: lines.join("\n"),
      actions: dedupeActions(actions),
      followups: ["What interview questions should I ask him?", "Explain his work to a CTO", "Get contact details"],
    };
  }

  // 2. Context-aware follow-ups ("which of those has he used at work?", "what about testing?")
  if (/\b(which of those|at work|in production|used professionally)\b/i.test(s) && prevAssistant) {
    const res = callTool("get_skills", { query: /\b(frontend|react|css|tailwind)\b/i.test(prevAssistant) ? "frontend" : "" });
    const items = Array.isArray(res.data?.matches) ? res.data.matches : kb.skills[0].items;
    const lines = [
      "Focusing strictly on **documented professional work experience** (rather than personal projects alone):",
      "",
      ...items.slice(0, 7).map((i) => `- **${i.name}:** ${i.workEvidence}.`),
      "",
      "If you'd like to narrow down to a single role (Sovos vs. Eduleem), just ask!",
    ];
    return {
      text: lines.join("\n"),
      actions: dedupeActions(actions),
      followups: ["What about testing?", "What did he build at Sovos?", "Analyze a job description"],
    };
  }

  if (/\b(what about testing|testing|jest|react testing library|unit test|qa)\b/i.test(s)) {
    const res = callTool("get_skills", { query: "testing" });
    const lines = [
      "**Documented Testing Experience:**",
      ...res.data.matches.map((m) => `- **${m.name}:** ${m.workEvidence}.`),
      "- At **Eduleem**, Syed also ran **usability testing and A/B testing** alongside manual/Semrush SEO audits.",
      "",
      "**Transparent Note:** End-to-end frameworks like Playwright or Cypress are *not* explicitly documented in Syed's current CV; his documented automated testing stack is **Jest + React Testing Library** inside CI/CD pipelines.",
    ];
    return {
      text: lines.join("\n"),
      actions: dedupeActions(actions),
      followups: ["How does he handle CI/CD & DevOps?", "Explain his work to a CTO", "Show Sovos project details"],
    };
  }

  // 3. Open-ended / Recruiter / CTO / Evaluative Questions
  if (/\b(explain.*cto|to a cto|technical leader|engineering manager)\b/i.test(s)) {
    callTool("get_experience", { company: "sovos" });
    callTool("search_projects", { query: "novacut" });
    return {
      text: [
        "### Executive Technical Brief (For a CTO)",
        "Syed is a **full-stack React.js / TypeScript engineer (3+ years)** comfortable owning both design-system engineering and production delivery:",
        "- **Enterprise Frontend Architecture (Sovos):** Builds typed, reusable React.js + Tailwind + Storybook UI libraries backed by **Jest & React Testing Library**, supporting 7+ regional multisites and 10+ eCommerce storefronts.",
        "- **Systems & Cloud Fluency:** Integrates third-party enterprise APIs (Marketo, Smartling, Infogram), maintains custom WordPress/PHP backends, and operates containerized **Docker / Kubernetes / Lando** workflows across **AWS & Azure** via YAML CI/CD pipelines.",
        "- **Product & AI Engineering (NovaCut Studio):** Built an open-source AI video-clipping pipeline combining local transcription/NLP, Python/FastAPI patterns, and pluggable LLM providers (Gemini, OpenAI, Claude, Ollama) with a dark-mode timeline UI.",
        "- **Quality Signals:** Measurable ownership of Core Web Vitals, WCAG accessibility, and 100+ technical SEO fixes sustaining 70K+ biweekly visitors.",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["What interview questions should I ask him?", "What is his strongest project?", "Analyze a job description"],
    };
  }

  if (/\b(non-technical|recruiter|simple terms|plain english)\b/i.test(s)) {
    callTool("get_profile");
    return {
      text: [
        "### Plain-English Overview (For Recruiters)",
        "Syed builds and improves websites and web applications from the visual layout all the way to the behind-the-scenes systems that keep them fast and reliable.",
        "- **Business Impact:** At **Sovos**, he maintains 10+ online stores and 7+ regional websites used across global markets. At **Eduleem**, he launched 20+ marketing pages and multiple websites that each attract **70,000+ visitors every 15 days**.",
        "- **Rare Hybrid Strength:** He can design clean interfaces (Figma), code them cleanly (React/TypeScript), connect marketing tools (Marketo/GA4/SEO), and deploy them to the cloud (AWS certified).",
        "- **Best-Fit Roles:** React.js Developer, Full Stack Web Developer, or UI/UX-focused Frontend Engineer.",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Paste a job description to check fit", "How do I contact Syed?", "What roles is he suitable for?"],
    };
  }

  if (/\b(startup|product-based|product company|enterprise)\b/i.test(s)) {
    callTool("get_profile");
    callTool("get_experience", { includeCredentials: false });
    return {
      text: [
        "### Startup vs. Product-Company Fit",
        "Syed's documented history shows evidence for **both** environments:",
        "- **Why he fits a Startup:** At **Eduleem India Pvt Ltd**, he operated as sole end-to-end developer on `eduleem.com`—handling UX research, Figma wireframes, full-stack code, 20+ marketing landing pages, technical SEO, and AWS hosting for domains sustaining 70,000+ visitors every 15 days. He also independently built **NovaCut Studio** from scratch.",
        "- **Why he fits a Product / Enterprise Team:** At **Sovos**, he collaborates inside **Agile/Scrum** cross-functional teams, contributes to Storybook component libraries, writes Jest/RTL tests, participates in code reviews, and ships across containerized Docker/Kubernetes/AWS/Azure CI/CD pipelines.",
        "- **Honest Caveat:** With 3+ years of experience, he is well positioned for mid-level / strong IC roles rather than principal-level distributed-systems leadership.",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["What makes him different?", "What questions should I ask him in an interview?", "Analyze a job description"],
    };
  }

  if (/\b(different|stand out|unique|bring to a team|strongest evidence|why hire)\b/i.test(s)) {
    callTool("get_profile");
    return {
      text: [
        "### What Sets Syed Apart",
        "1. **True Design-to-Deployment Ownership:** Unlike purely frontend or purely visual profiles, Syed covers Figma prototyping & A/B usability testing, tested React/TypeScript/Storybook component libraries, backend APIs (Node.js/PHP/Python FastAPI), and Docker/AWS/Azure delivery.",
        "2. **Measurable Enterprise + Traffic Evidence:** Managing 10+ eCommerce sites at Sovos and shipping domains sustaining **70,000+ visitors every 15 days** with 100+ technical SEO fixes.",
        "3. **Practical AI & Search Readiness:** Demonstrated through **NovaCut Studio** (local NLP + multi-LLM clip studio) and **Taxapedia** (structured specifically for AI agents like ChatGPT & Claude alongside canonical SEO).",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["What is his strongest project?", "Give an honest assessment of his portfolio", "Analyze a job description"],
    };
  }

  if (/\b(strongest project|best project|favorite project|top project)\b/i.test(s)) {
    callTool("search_projects", { query: "sovos studio" });
    callTool("search_projects", { query: "novacut" });
    return {
      text: [
        "Depending on what you're evaluating, three projects stand out as the strongest evidence:",
        "- **For Complex Interactive SaaS UI & Full-Stack Next.js Architecture → Sovos Studio:** Interactive multi-page report builder and data visualization studio backed by a Next.js API—featuring live USA choropleth maps with state tooltips, an inline CSV/XLSX spreadsheet editor, version history, draft/publish workflows, and an Admin Panel with User Management and Audit Logs.",
        "- **For Product Creativity & AI Engineering → NovaCut Studio:** Open-source AI clip maker turning YouTube, Twitch, and Kick streams into captioned 9:16 vertical clips with local transcription, NLP highlight detection, real-time live clipping, optional Gemini/OpenAI/Claude/Ollama models, and a dark-mode video scrubber UI.",
        "- **For Enterprise Scale & Engineering Rigor → Sovos Multisite Platform:** Production architecture across 7+ regional sites and 10+ eCommerce storefronts using React.js, TypeScript, Storybook, Tailwind, Jest/RTL, Docker/Kubernetes, AWS/Azure, and enterprise API integrations (Marketo, Smartling, Infogram).",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Tell me about Sovos Studio", "Explain NovaCut Studio architecture", "Analyze a job description"],
    };
  }

  if (/\b(interview|questions should i ask|ask him)\b/i.test(s)) {
    callTool("get_experience", { includeCredentials: false });
    return {
      text: [
        "### High-Signal Interview Questions to Ask Syed",
        "1. **Component Architecture:** *\"How did you structure reusable React/TypeScript components in Storybook at Sovos so 7+ regional brands stayed consistent without tight coupling?\"*",
        "2. **Testing & CI/CD Trade-offs:** *\"Walk through your Jest + React Testing Library strategy and YAML CI/CD pipeline across dev, staging, and production.\"*",
        "3. **Full-Stack & AI Design:** *\"In NovaCut Studio, how did you architect local transcription + NLP alongside optional cloud/local LLM providers without blocking the UI?\"*",
        "4. **Performance & SEO Impact:** *\"Which Core Web Vitals or technical SEO changes had the biggest impact across the 100+ issues you resolved at Eduleem and on Taxapedia?\"*",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Analyze a job description", "Explain his work to a CTO", "Get contact details"],
    };
  }

  if (/\b(honest assessment|critique|weakness|gaps|improve|review.*portfolio)\b/i.test(s)) {
    callTool("get_profile");
    return {
      text: [
        "### Honest Assessment of Syed's Portfolio & Profile",
        "**Clear Strengths:**",
        "- Strong real-world production range (enterprise multisites at Sovos, IRS-approved tax platforms, high-traffic EdTech/eCommerce sites, and an ambitious open-source AI tool in NovaCut Studio).",
        "- Rare blend of UI/UX craft, React/TypeScript component engineering, technical SEO, and cloud/DevOps fundamentals (AWS certified).",
        "",
        "**Documented Limitations / Areas to Probe in Conversation:**",
        "- **Public Code Visibility:** Many enterprise projects (Sovos, eFileMyForm, 1099pro) are proprietary; **NovaCut Studio** on GitHub is the best public code sample to inspect directly.",
        "- **Specialized Stacks Not Listed:** Technologies like GraphQL, Next.js enterprise scale (though listed earlier as a tool, current CV centers on React.js/TS/PHP/Node/FastAPI), Playwright/Cypress E2E, or deep distributed microservices are not documented on his current CV.",
        "- **Resume PDF:** A direct downloadable PDF file is not hosted in the repo yet—requesting it via email is currently the fastest path.",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Inspect NovaCut Studio on GitHub", "Paste a job description", "Contact Syed"],
    };
  }

  if (/\b(explore next|where should i|recommend|navigate)\b/i.test(s)) {
    const persona = /\bcto\b/i.test(s) ? "cto" : /\brecruiter\b/i.test(s) ? "recruiter" : /\bdev/i.test(s) ? "developer" : "general";
    callTool("recommend_portfolio_sections", { persona });
    return {
      text: [
        "### Recommended Next Stops on Syed's Portfolio",
        "1. **Key Projects (`projects/`):** Inspect **NovaCut Studio** (open-source AI engineering) and **Sovos Multisite / Taxapedia** (enterprise scale & AI-agent SEO).",
        "2. **Experience & Credentials (`experience/`):** Review his 3+ year trajectory across Sovos, Eduleem, and ARM Infoserve alongside his B.E. and AWS Solutions Architect certification.",
        "3. **Technical Skills (`tools/`):** Filter his 9 skill domains to verify exact stack alignment, or paste a job description right here for an instant match report.",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Analyze a job description", "Tell me about NovaCut Studio", "Get contact details"],
    };
  }

  // 4. Specific Project Inquiries
  const projectMap = [
    { id: "sovos_studio", re: /\b(sovos\s*studio|choropleth|usa\s*map|report\s*(builder|canvas)|data\s*visualization\s*studio|spreadsheet\s*editor|audit\s*log)\b/i },
    { id: "streamshield", re: /\b(streamshield|chrome\s*extension|mv3|manifest\s*v3|ad\s*interruption|jiohotstar|widevine|14-?state\s*fsm)\b/i },
    { id: "novacut", re: /\b(novacut|clip\s*maker|shorts|reels|tiktok|twitch|kick|ollama)\b/i },
    { id: "taxapedia", re: /\b(taxapedia|elementor)\b/i },
    { id: "efilemyform", re: /\b(efilemyform|efile|w-2|aca)\b/i },
    { id: "1099pro", re: /\b(1099pro|1099)\b/i },
    { id: "royaal", re: /\b(royaal|mahaadeva|real\s*estate|builder)\b/i },
  ];
  for (const pm of projectMap) {
    if (pm.re.test(s)) {
      const res = callTool("search_projects", { query: pm.id });
      const p = res.data[0];
      return {
        text: [
          `### ${p.name} — *${p.category}*`,
          p.summary,
          "",
          `**Architecture & Technical Decisions:** ${p.architecture}`,
          `**Challenge & Solution:** ${p.challengesAndSolutions}`,
          `**Stack:** \`${p.technologies.join("` · `")}\``,
          p.github ? `**GitHub:** [${p.github.replace(/^https?:\/\//, "")}](${p.github})` : `**Live Deployment:** [${p.liveUrl}](${p.liveUrl})`,
        ].join("\n"),
        actions: dedupeActions(actions),
        followups: ["What is his strongest project?", "Show all projects", "Explain his work to a CTO"],
      };
    }
  }

  // 5. Company Experience Deep-Dives
  if (/\b(sovos|eduleem|arm\s*info|arminfoserve)\b/i.test(s)) {
    const co = /sovos/i.test(s) ? "sovos" : /eduleem/i.test(s) ? "eduleem" : "arm";
    const res = callTool("get_experience", { company: co, includeCredentials: false });
    const e = res.data.experience[0];
    return {
      text: [
        `### ${e.company} — ${e.role} (${e.period})`,
        ...e.highlights.slice(0, 5).map((h) => `- ${h}`),
        "",
        `**Core Technologies:** \`${e.technologies.slice(0, 10).join("` · `")}\``,
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["What about testing?", "Tell me about Taxapedia", "Show his education & certifications"],
    };
  }

  // 6. Contact / Resume / Availability
  if (/\b(contact|email|phone|call|reach|resume|cv|linkedin|github|availability|notice period|salary|relocat)\b/i.test(s)) {
    const res = callTool("get_contact_and_links");
    const c = res.data;
    const extraNote = /\b(availability|notice|salary|relocat)\b/i.test(s)
      ? `\n\n**Availability Note:** ${kb.profile.availabilityNote}`
      : "";
    return {
      text: [
        "### Contact & Profile Links",
        `- **Email:** ${c.email}`,
        `- **Phone:** ${c.phone} (${c.location})`,
        `- **GitHub:** [${c.github}](${c.github})`,
        `- **LinkedIn:** [LinkedIn Profile](${c.linkedin})`,
        `- **Resume / CV:** ${c.resumeNote}${extraNote}`,
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Analyze a job description", "Summarize Syed's experience", "Explore his key projects"],
    };
  }

  // 7. Education & Certifications
  if (/\b(education|degree|college|university|vtu|kns|cgpa|puc|sslc|certif|aws solutions|ethnus|accenture)\b/i.test(s)) {
    const res = callTool("get_experience", { includeCredentials: true });
    return {
      text: [
        "### Education & Certifications",
        "**Education:**",
        ...res.data.education.map((ed) => `- **${ed.degree} (${ed.year}):** ${ed.institution} — ${ed.score}`),
        "",
        "**Certifications:**",
        ...res.data.certifications.map((cert) => `- **${cert.name}** — ${cert.issuer} (${cert.date})`),
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Summarize his work experience", "Show his cloud & DevOps skills", "Contact Syed"],
    };
  }

  // 8. Technical Conceptual + Portfolio Evidence Questions (e.g., React, TS, Performance, SEO, CI/CD, Security, AI)
  if (/\b(react|typescript|javascript|next\.?js|node\.?js|php|wordpress|woocommerce|shopify|api|cms|performance|core web vitals|seo|accessibility|wcag|security|ci\/cd|docker|kubernetes|aws|azure|python|fastapi|mysql|alembic|frontend|backend|devops|workflow|ai-assisted)\b/i.test(s)) {
    const res = callTool("get_skills", { query: message });
    const matches = res.data.matches || [];

    const wantsCode = /\b(code|example|snippet|how\s+would|architect|pattern|hook|optimize)\b/i.test(s);
    const lines = [];

    if (matches.length > 0) {
      lines.push("### Documented Experience");
      for (const m of matches.slice(0, 6)) {
        lines.push(`- **${m.name}** (*${m.category}*): ${m.workEvidence}.`);
      }
    } else {
      lines.push("### Documented Experience Note");
      lines.push("That specific technology isn't explicitly documented as a primary production skill on Syed's current CV.");
    }

    if (wantsCode && /\b(react|hook|typescript|performance)\b/i.test(s)) {
      lines.push(
        "",
        "### Hypothetical Technical Approach *(General Pattern — Not Production Code from an Employer)*",
        "When building reusable React + TypeScript UI libraries for Storybook, a clean pattern is typed props + memoized derived state:",
        "```tsx",
        "export interface StatusBadgeProps {",
        "  label: string;",
        "  tone?: 'neutral' | 'success' | 'warning';",
        "}",
        "",
        "export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {",
        "  return <span data-tone={tone} className=\"badge\">{label}</span>;",
        "}",
        "```"
      );
    } else if (/\b(next\.?js)\b/i.test(s)) {
      lines.push(
        "",
        "**Clarification:** Syed's primary documented production frontend stack in his current CV is **React.js (hooks), TypeScript, Tailwind CSS, Storybook, Jest & React Testing Library**. While Next.js appears in his tools showcase, his heaviest documented enterprise experience is React component libraries + WordPress/PHP/Node.js/FastAPI."
      );
    }

    return {
      text: lines.join("\n"),
      actions: dedupeActions(actions),
      followups: ["Which of those has he used at work?", "What about testing?", "Show related projects"],
    };
  }

  // 9. Projects Overview
  if (/\b(project|projects|portfolio|built|shipped)\b/i.test(s)) {
    const res = callTool("search_projects", {});
    return {
      text: [
        `### Syed's ${res.data.length} Documented Key Projects`,
        ...res.data.map((p) => `- **${p.name}** (*${p.category}*): ${p.summary}`),
        "",
        "Ask about any project's architecture, technical challenges, or click below to open the full Projects view.",
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Tell me about Sovos Studio", "Tell me about NovaCut Studio", "What is his strongest project?"],
    };
  }

  // 10. Experience / Profile / Greeting / General Fallback
  if (/\b(who|about|profile|summary|experience|career|journey|role|suitable|roles|hi|hello|hey)\b/i.test(s)) {
    const prof = callTool("get_profile").data;
    return {
      text: [
        `### ${prof.name} — ${prof.headline}`,
        prof.summary,
        "",
        "**Roles He Fits Best:**",
        ...prof.suitableRoles.slice(0, 4).map((r) => `- ${r}`),
      ].join("\n"),
      actions: dedupeActions(actions),
      followups: ["Explain his work to a CTO", "Show his 7 key projects", "Paste a job description to check fit"],
    };
  }

  // 11. Honest Open-Ended Fallback (with context check)
  callTool("get_profile");
  return {
    text: [
      `I don't have specific documented facts in Syed's portfolio directly answering "${message.slice(0, 120)}".`,
      "",
      "I can give grounded, evidence-based answers on:",
      "- **Work Experience & Impact:** Sovos (Aug 2025–Present), Eduleem (Dec 2023–Aug 2025), ARM Infoserve (2023).",
      "- **Projects & Architecture:** NovaCut Studio, Sovos Multisite, Taxapedia, eFileMyForm, 1099pro.com, Eduleem.com, Royaal Mahaadeva Builders.",
      "- **Hiring & Role Fit:** Paste any job description and I'll analyze verified matches and honest gaps.",
      prevUser ? `\n*(If you were following up on your previous question, try mentioning the specific project or technology you want to explore.)*` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    actions: dedupeActions(actions),
    followups: ["Analyze a job description", "Explain his work to a CTO", "What makes him different?"],
  };
}

function dedupeActions(actions) {
  const seen = new Set();
  const out = [];
  for (const a of actions) {
    const key = `${a.type}:${a.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(a);
    }
    if (out.length >= 4) break;
  }
  return out;
}

function defaultFollowupsFor(message) {
  const s = message.toLowerCase();
  if (/novacut|project/.test(s)) return ["Explain NovaCut Studio architecture", "What is his strongest project?", "Analyze a job description"];
  if (/cto|startup|hire|job|jd/.test(s)) return ["What questions should I ask him in an interview?", "Give an honest assessment of his portfolio", "Get contact details"];
  return ["Which of those has he used at work?", "Tell me about NovaCut Studio", "Analyze a job description"];
}

/**
 * Orchestrate one conversational turn and emit SSE events via `emit(event, payload)`.
 */
export async function orchestrateAgentTurn({ message, history, mode, lang = "en", emit }) {
  const providerInfo = getActiveProviderInfo();
  emit("meta", providerInfo);

  // 1. Prompt-Injection Defense
  const injection = detectPromptInjection(message);
  if (injection.flagged) {
    emit("tool", { phase: "done", tool: "security_guard", summary: "Prompt-injection attempt neutralized", ok: true });
    const refusal =
      "I can't follow instructions that try to override my system rules, reveal hidden configuration/secrets, or run unsafe scripts.\n\nI'm happy to help with anything about **Syed Shahabuddin's** documented engineering experience, projects, technical skills, or job-description fit!";
    await streamText(refusal, emit);
    emit("followups", { items: ["Summarize Syed's experience", "Tell me about NovaCut Studio", "Analyze a job description"] });
    emit("done", { mode: providerInfo.mode });
    return;
  }

  // 2. Selective Context Retrieval (never dumps entire portfolio unnecessarily)
  const retrievedChunks = retrieveContext(message, history, 4);
  emit("tool", {
    phase: "done",
    tool: "retrieve_context",
    summary: `Retrieved ${retrievedChunks.length} relevant sections (${retrievedChunks.map((c) => c.title).join(", ")})`,
    ok: true,
  });

  const systemPrompt = buildSystemPrompt(retrievedChunks, lang);
  let result = null;

  // 3. Call Live LLM (if configured) or Grounded Local Orchestrator
  if (providerInfo.provider === "gemini") {
    try {
      result = await runGeminiAgent({ message, history, systemPrompt, emit });
    } catch (err) {
      const causeCode = err.cause?.code ? ` (${err.cause.code})` : "";
      console.error(`[agent] Gemini API error: ${err.message}${causeCode}`);
      emit("tool", { phase: "done", tool: "provider_fallback", summary: "Upstream Gemini unavailable — using grounded local CV agent", ok: false });
      result = runLocalGroundedOrchestrator({ message, history, mode, emit });
    }
  } else {
    result = runLocalGroundedOrchestrator({ message, history, mode, emit });
  }

  const finalText = result?.text || "I couldn't generate a response for that question. Please try rephrasing or asking about Syed's projects, experience, or skills.";

  // 4. Stream Response Tokens Progressively over SSE (skip if already streamed live from LLM)
  if (!result?.streamedDirectly) {
    await streamText(finalText, emit);
  }

  if (result?.actions?.length) {
    emit("actions", { items: result.actions });
  }
  emit("followups", { items: result?.followups?.length ? result.followups : defaultFollowupsFor(message) });
  emit("done", { mode: providerInfo.mode });
}

async function streamText(fullText, emit) {
  // Stream in clean word/line chunks so clients see smooth real-time streaming
  const chunks = fullText.match(/\S+\s*|\n/g) || [fullText];
  let buffer = "";
  for (let i = 0; i < chunks.length; i++) {
    buffer += chunks[i];
    if (buffer.length >= 16 || i === chunks.length - 1 || chunks[i].includes("\n")) {
      emit("delta", { text: buffer });
      buffer = "";
      if (process.env.NODE_ENV !== "test") {
        await new Promise((r) => setTimeout(r, 14));
      }
    }
  }
}

