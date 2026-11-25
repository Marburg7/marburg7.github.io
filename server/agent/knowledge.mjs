/**
 * Structured Knowledge Loader & Selective Context Retriever
 * Loads data/portfolio-knowledge.json and retrieves ONLY the top-relevant
 * chunks for a given query + recent conversation history.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_PATH = path.resolve(__dirname, "../../data/portfolio-knowledge.json");

let cachedKnowledge = null;
let cachedChunks = null;

export function loadKnowledge() {
  if (cachedKnowledge) return cachedKnowledge;
  const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf-8");
  cachedKnowledge = JSON.parse(raw);
  cachedChunks = buildChunks(cachedKnowledge);
  return cachedKnowledge;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildChunks(kb) {
  const chunks = [];

  chunks.push({
    id: "profile",
    type: "profile",
    title: "Profile & Summary",
    keywords: ["who", "syed", "about", "summary", "profile", "role", "current", "years", "location", "bengaluru", "startup", "product", "different", "strengths", "career", "hire", "cto", "recruiter"],
    content: JSON.stringify(kb.profile),
  });

  chunks.push({
    id: "contact",
    type: "contact",
    title: "Contact & Links",
    keywords: ["contact", "email", "phone", "call", "reach", "linkedin", "github", "resume", "cv", "availability", "hire", "location"],
    content: JSON.stringify(kb.contact),
  });

  for (const exp of kb.experience) {
    chunks.push({
      id: `exp:${exp.id}`,
      type: "experience",
      title: `Work Experience — ${exp.company}`,
      keywords: [...tokenize(exp.company), ...tokenize(exp.role), ...exp.technologies.flatMap(tokenize), "experience", "work", "job", "career", "company", "team", "enterprise", "ecommerce", "seo", "traffic"],
      content: JSON.stringify(exp),
    });
  }

  for (const proj of kb.projects) {
    chunks.push({
      id: `project:${proj.id}`,
      type: "project",
      title: `Project — ${proj.name}`,
      keywords: [...tokenize(proj.name), ...tokenize(proj.category), ...tokenize(proj.summary), ...proj.technologies.flatMap(tokenize), "project", "projects", "portfolio", "architecture", "challenge", "strongest", "github", "live", "ai", "open", "source"],
      content: JSON.stringify(proj),
    });
  }

  for (const group of kb.skills) {
    const allAliases = group.items.flatMap((i) => [i.name, ...(i.aliases || [])]);
    chunks.push({
      id: `skills:${group.id}`,
      type: "skills",
      title: `Skills — ${group.category}`,
      keywords: [...tokenize(group.category), ...allAliases.flatMap(tokenize), "skill", "skills", "stack", "tech", "technology", "tools", "work", "testing", "frontend", "backend", "cloud", "devops", "seo", "design"],
      content: JSON.stringify(group),
    });
  }

  chunks.push({
    id: "credentials",
    type: "credentials",
    title: "Education & Certifications",
    keywords: ["education", "degree", "college", "university", "vtu", "kns", "cgpa", "puc", "sslc", "certification", "certifications", "aws", "ethnus", "accenture"],
    content: JSON.stringify({ education: kb.education, certifications: kb.certifications }),
  });

  chunks.push({
    id: "articles",
    type: "articles",
    title: "Blog & Editorial Writing",
    keywords: ["blog", "article", "articles", "thoughts", "writing", "dashboard", "future", "posts"],
    content: JSON.stringify(kb.articles),
  });

  return chunks;
}

/**
 * Selective retrieval: scores chunks against the current query + recent context
 * and returns only the top-K relevant chunks (default max 4) to keep prompt size tight.
 */
export function retrieveContext(query, history = [], maxChunks = 4) {
  loadKnowledge();
  const recentUserText = history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join(" ");

  const queryTokens = tokenize(query);
  const contextTokens = tokenize(recentUserText);
  const lowerQuery = String(query || "").toLowerCase();

  const scored = cachedChunks.map((chunk) => {
    let score = 0;
    const kwSet = new Set(chunk.keywords);
    const bodyLower = chunk.content.toLowerCase();

    for (const tok of queryTokens) {
      if (kwSet.has(tok)) score += 3.5;
      else if (bodyLower.includes(tok)) score += 1.4;
    }

    // Mild boost from recent conversation turns for follow-up continuity
    for (const tok of contextTokens) {
      if (kwSet.has(tok)) score += 0.7;
    }

    // Boost profile slightly for broad evaluative/recruiter questions
    if (chunk.id === "profile" && /\b(who|summary|hire|startup|product|cto|recruiter|different|strength|interview|assess)\b/.test(lowerQuery)) {
      score += 4;
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected = scored.filter((s) => s.score > 0).slice(0, maxChunks).map((s) => s.chunk);
  if (selected.length === 0) {
    return cachedChunks.filter((c) => c.id === "profile" || c.id === "project:novacut" || c.id === "exp:sovos");
  }
  return selected;
}

