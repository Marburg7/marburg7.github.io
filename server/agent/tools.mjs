/**
 * Controlled Agent Tool Registry & Strict Validators
 * Whitelisted read-only portfolio tools + Evidence-Based Job Description Analyzer.
 * Zero filesystem writes, zero shell execution, zero arbitrary network calls.
 */
import { loadKnowledge } from "./knowledge.mjs";

const ALLOWED_PERSONAS = new Set(["recruiter", "cto", "developer", "client", "designer", "general"]);

function clampString(val, maxLen = 200) {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

/**
 * JSON Schema Tool Declarations (compatible with Gemini Function Calling & OpenAI Tools)
 */
export const TOOL_DECLARATIONS = [
  {
    name: "get_profile",
    description: "Retrieve Syed Shahabuddin's documented professional summary, current role, years of experience, suitable roles, team strengths, and career interests.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "search_projects",
    description: "Retrieve detailed documented information about Syed's projects (architecture, technologies, challenges, solutions, GitHub repos, live URLs). Optionally filter by project name/id or topic keyword.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional project id, name, or technology keyword (e.g., 'streamshield', 'novacut', 'taxapedia', 'sovos', 'ai', 'react', 'wordpress'). Leave empty to list all projects.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_experience",
    description: "Retrieve Syed's documented work experience, companies (Sovos, Eduleem, ARM Infoserve), education, and certifications.",
    parameters: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description: "Optional company filter ('sovos', 'eduleem', 'arm'). Omit for complete work history.",
        },
        includeCredentials: {
          type: "boolean",
          description: "Set true to also return Education and Certifications.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_skills",
    description: "Retrieve Syed's documented technical skills with explicit work-experience vs project evidence, optionally filtered by category or specific technology names.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional skill name or category (e.g., 'frontend', 'testing', 'react', 'docker', 'seo', 'python').",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "analyze_job_description",
    description: "Perform a structured, evidence-based fit analysis comparing a pasted job description against Syed's documented skills, work experience, and projects—identifying verified matches, relevant projects, and honest gaps.",
    parameters: {
      type: "object",
      properties: {
        jobDescription: {
          type: "string",
          description: "The job description text provided by the visitor.",
        },
      },
      required: ["jobDescription"],
      additionalProperties: false,
    },
  },
  {
    name: "recommend_portfolio_sections",
    description: "Recommend the best portfolio sections and projects for a visitor to explore next based on their role or interest.",
    parameters: {
      type: "object",
      properties: {
        persona: {
          type: "string",
          enum: ["recruiter", "cto", "developer", "client", "designer", "general"],
          description: "Visitor profile or perspective.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_contact_and_links",
    description: "Retrieve Syed's documented contact information (email, phone, Bengaluru location), GitHub, LinkedIn, and resume/CV access note.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

/* --- Requirement Extraction Dictionary for Honest JD Gap Detection --- */
const COMMON_EXTERNAL_TECH = [
  { name: "GraphQL", re: /\bgraphql\b/i },
  { name: "Angular", re: /\bangular\b/i },
  { name: "Vue.js", re: /\bvue(\.?js)?\b/i },
  { name: "Svelte", re: /\bsvelte\b/i },
  { name: "React Native", re: /\breact\s+native\b/i },
  { name: "Flutter", re: /\bflutter\b/i },
  { name: "Swift / iOS", re: /\b(swift|swiftui|ios\s+development)\b/i },
  { name: "Kotlin / Android", re: /\b(kotlin|android\s+sdk)\b/i },
  { name: "Go (Golang)", re: /\b(golang|\bgo\s+developer|\bgo\s+backend)\b/i },
  { name: "Rust", re: /\brust\b/i },
  { name: "C# / .NET", re: /\b(c#|\.net|asp\.net)\b/i },
  { name: "Ruby on Rails", re: /\b(ruby\s+on\s+rails|rails)\b/i },
  { name: "Spring Boot", re: /\bspring\s*boot\b/i },
  { name: "PostgreSQL", re: /\b(postgres|postgresql)\b/i },
  { name: "MongoDB", re: /\bmongodb\b/i },
  { name: "Redis", re: /\bredis\b/i },
  { name: "Kafka", re: /\bkafka\b/i },
  { name: "Terraform", re: /\bterraform\b/i },
  { name: "Playwright / Cypress", re: /\b(playwright|cypress)\b/i },
  { name: "Redux / Zustand", re: /\b(redux|zustand)\b/i },
  { name: "Next.js", re: /\bnext(\.?js)?\b/i },
  { name: "Django", re: /\bdjango\b/i },
  { name: "Laravel", re: /\blaravel\b/i },
  { name: "WebGL / Three.js", re: /\b(webgl|three\.?js)\b/i },
];

export function analyzeJobDescription(jdText) {
  const kb = loadKnowledge();
  const text = clampString(jdText, 5500);
  if (text.length < 15) {
    return {
      error: "Please provide a fuller job description (at least a few lines of role requirements) so I can run an accurate evidence-based analysis.",
    };
  }

  const lower = text.toLowerCase();
  const matchedSkills = [];
  const allSkillItems = kb.skills.flatMap((g) => g.items.map((item) => ({ ...item, category: g.category })));

  for (const item of allSkillItems) {
    const terms = [item.name.toLowerCase(), ...(item.aliases || []).map((a) => a.toLowerCase())];
    const hit = terms.some((t) => {
      if (t.length < 2) return false;
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(lower);
    });
    if (hit) {
      matchedSkills.push({
        skill: item.name,
        category: item.category,
        workEvidence: item.workEvidence,
        projectEvidence: item.projectEvidence,
      });
    }
  }

  // Detect requested skills NOT explicitly documented in CV
  const gaps = [];
  for (const ext of COMMON_EXTERNAL_TECH) {
    if (ext.re.test(text)) {
      const alreadyMatched = matchedSkills.some((m) => m.skill.toLowerCase().includes(ext.name.toLowerCase().split(" ")[0]));
      if (!alreadyMatched) {
        gaps.push({
          requirement: ext.name,
          status: "Not explicitly documented in Syed's current CV/portfolio",
        });
      }
    }
  }

  // Check seniority / years requirement if mentioned
  let experienceCheck = {
    documented: "3+ years of professional full-stack & React.js experience (2023 – Present across Sovos, Eduleem, ARM Infoserve)",
    gapNote: null,
  };
  const yearsMatch = text.match(/(\d+)\s*\+?\s*(?:to\s*\d+\s*)?years?/i);
  if (yearsMatch) {
    const reqYears = parseInt(yearsMatch[1], 10);
    if (reqYears >= 5) {
      experienceCheck.gapNote = `The JD asks for ${reqYears}+ years of experience; Syed has 3+ documented years, so this would be a stretch on raw tenure despite strong enterprise scope at Sovos.`;
    } else if (reqYears <= 4) {
      experienceCheck.gapNote = `Aligns well with the JD's ${reqYears}+ year expectation (Syed has 3+ documented years).`;
    }
  }

  // Rank relevant projects by overlap with JD text
  const relevantProjects = kb.projects
    .map((p) => {
      let score = 0;
      for (const tech of p.technologies) {
        if (lower.includes(tech.toLowerCase().split(" ")[0])) score += 2;
      }
      if (lower.includes("ecommerce") && (p.id === "sovos" || p.id === "eduleem")) score += 3;
      if ((lower.includes("ai") || lower.includes("llm") || lower.includes("python")) && (p.id === "novacut" || p.id === "taxapedia")) score += 3;
      if ((lower.includes("chrome") || lower.includes("extension") || lower.includes("mv3") || lower.includes("playwright") || lower.includes("vitest")) && p.id === "streamshield") score += 4;
      if (lower.includes("seo") && (p.id === "taxapedia" || p.id === "eduleem")) score += 3;
      if ((lower.includes("wordpress") || lower.includes("cms")) && (p.id === "sovos" || p.id === "taxapedia" || p.id === "eduleem")) score += 2;
      return { project: p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ project }) => ({
      id: project.id,
      name: project.name,
      role: project.role,
      liveUrl: project.liveUrl,
      github: project.github,
      reason: project.summary,
    }));

  // Compute transparent, evidence-based fit tier
  const totalSignals = matchedSkills.length + gaps.length;
  const ratio = totalSignals > 0 ? matchedSkills.length / totalSignals : 0;
  let fitLevel = "Partial / Exploratory Fit";
  if (matchedSkills.length >= 5 && ratio >= 0.7 && !experienceCheck.gapNote?.includes("stretch")) {
    fitLevel = "Strong Match";
  } else if (matchedSkills.length >= 3 && ratio >= 0.45) {
    fitLevel = "Solid Match (with targeted ramp-up areas)";
  } else if (matchedSkills.length === 0) {
    fitLevel = "Low Direct Match (limited documented overlap)";
  }

  return {
    fitAssessment: fitLevel,
    matchedCount: matchedSkills.length,
    gapCount: gaps.length,
    experienceCheck,
    matchedSkills: matchedSkills.slice(0, 10),
    potentialGaps: gaps.slice(0, 8),
    relevantProjects,
    recommendedPortfolioLinks: [
      { label: "Key Projects", path: "projects/" },
      { label: "Full Experience & Credentials", path: "experience/" },
      { label: "Technical Skills Matrix", path: "tools/" },
    ],
  };
}

/**
 * Execute a whitelisted tool by name with validated arguments.
 * Returns { ok, toolName, summary, data, uiActions }.
 */
export function executeTool(toolName, rawArgs = {}) {
  const kb = loadKnowledge();
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};

  switch (toolName) {
    case "get_profile": {
      return {
        ok: true,
        toolName,
        summary: "Retrieved documented profile & strengths",
        data: kb.profile,
        uiActions: [
          { label: "View Experience", type: "navigate", value: "experience/" },
          { label: "Explore Projects", type: "navigate", value: "projects/" },
        ],
      };
    }

    case "search_projects": {
      const q = clampString(args.query, 120).toLowerCase();
      let matches = kb.projects;
      if (q) {
        matches = kb.projects.filter((p) => {
          const hay = `${p.id} ${p.name} ${p.category} ${p.summary} ${p.architecture} ${p.technologies.join(" ")}`.toLowerCase();
          return q.split(/\s+/).some((tok) => tok.length > 1 && hay.includes(tok));
        });
      }
      if (matches.length === 0) matches = kb.projects;
      const primary = matches[0];
      const uiActions = [];
      if (matches.length === 1 || q) {
        uiActions.push({ label: `Inspect ${primary.name}`, type: "open-case", value: primary.id });
        if (primary.github) uiActions.push({ label: "Open GitHub ↗", type: "external", value: primary.github });
        else if (primary.liveUrl) uiActions.push({ label: "Visit Live ↗", type: "external", value: primary.liveUrl });
      } else {
        uiActions.push({ label: "Browse All Projects", type: "navigate", value: "projects/" });
      }
      return {
        ok: true,
        toolName,
        summary: `Retrieved ${matches.length} project${matches.length === 1 ? "" : "s"}${q ? ` for "${q}"` : ""}`,
        data: matches,
        uiActions,
      };
    }

    case "get_experience": {
      const co = clampString(args.company, 80).toLowerCase();
      let exps = kb.experience;
      if (co) {
        const filtered = kb.experience.filter(
          (e) => e.id.includes(co) || e.company.toLowerCase().includes(co)
        );
        if (filtered.length) exps = filtered;
      }
      const data = { experience: exps };
      if (args.includeCredentials) {
        data.education = kb.education;
        data.certifications = kb.certifications;
      }
      return {
        ok: true,
        toolName,
        summary: `Retrieved ${exps.length} experience record${exps.length === 1 ? "" : "s"}${args.includeCredentials ? " + credentials" : ""}`,
        data,
        uiActions: [{ label: "Full Experience Page", type: "navigate", value: "experience/" }],
      };
    }

    case "get_skills": {
      const q = clampString(args.query, 120).toLowerCase();
      if (!q) {
        return {
          ok: true,
          toolName,
          summary: `Retrieved ${kb.skills.length} skill categories`,
          data: kb.skills,
          uiActions: [{ label: "Technical Skills Matrix", type: "navigate", value: "tools/" }],
        };
      }
      const tokens = q.split(/[\s,/]+/).filter((t) => t.length > 1);
      const matchedItems = [];
      for (const group of kb.skills) {
        const catHit = tokens.some((t) => group.category.toLowerCase().includes(t) || group.id.includes(t));
        for (const item of group.items) {
          const itemHay = `${item.name} ${(item.aliases || []).join(" ")} ${item.workEvidence}`.toLowerCase();
          if (catHit || tokens.some((t) => itemHay.includes(t))) {
            matchedItems.push({ category: group.category, ...item });
          }
        }
      }
      return {
        ok: true,
        toolName,
        summary: `Matched ${matchedItems.length} documented skill${matchedItems.length === 1 ? "" : "s"}`,
        data: { query: q, matches: matchedItems },
        uiActions: [{ label: "Open Skills Matrix", type: "navigate", value: "tools/" }],
      };
    }

    case "analyze_job_description": {
      const analysis = analyzeJobDescription(args.jobDescription);
      const uiActions = [];
      if (analysis.relevantProjects?.[0]) {
        uiActions.push({
          label: `Inspect ${analysis.relevantProjects[0].name}`,
          type: "open-case",
          value: analysis.relevantProjects[0].id,
        });
      }
      uiActions.push({ label: "Copy Syed's Email", type: "copy", value: kb.contact.email });
      uiActions.push({ label: "Contact Section", type: "scroll", value: "contact" });
      return {
        ok: !analysis.error,
        toolName,
        summary: analysis.error
          ? "Need more JD detail"
          : `Analyzed JD · ${analysis.fitAssessment} (${analysis.matchedCount} matched, ${analysis.gapCount} gaps)`,
        data: analysis,
        uiActions,
      };
    }

    case "recommend_portfolio_sections": {
      const persona = ALLOWED_PERSONAS.has(args.persona) ? args.persona : "general";
      const recs = kb.sections.filter((s) => persona === "general" || s.bestFor.includes(persona));
      const topProject = persona === "cto" || persona === "developer" ? kb.projects[0] : kb.projects[1];
      return {
        ok: true,
        toolName,
        summary: `Prepared recommendations for ${persona}`,
        data: { persona, sections: recs, highlightProject: { id: topProject.id, name: topProject.name, summary: topProject.summary } },
        uiActions: [
          { label: `Inspect ${topProject.name}`, type: "open-case", value: topProject.id },
          { label: "Full Experience", type: "navigate", value: "experience/" },
        ],
      };
    }

    case "get_contact_and_links": {
      return {
        ok: true,
        toolName,
        summary: "Retrieved verified contact & profile links",
        data: kb.contact,
        uiActions: [
          { label: "Copy Email", type: "copy", value: kb.contact.email },
          { label: "Open GitHub ↗", type: "external", value: kb.contact.github },
          { label: "Open LinkedIn ↗", type: "external", value: kb.contact.linkedin },
          { label: "Jump to Contact Form", type: "scroll", value: "contact" },
        ],
      };
    }

    default:
      return {
        ok: false,
        toolName,
        summary: "Unauthorized or unknown tool blocked",
        data: { error: `Tool "${String(toolName)}" is not permitted.` },
        uiActions: [],
      };
  }
}

