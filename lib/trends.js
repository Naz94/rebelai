// ============================================================
// REBEL ENGINE — Trend Intelligence (lib/trends.js)
// ============================================================

import OpenAI from "openai";
import { Redis } from "@upstash/redis";
import { fetchResourceSnapshot } from "./resources.js";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const INTELLIGENCE_KEY = "rebelai:intelligence_brief";

// Cache TTL: don't regenerate if brief is less than 4 hours old
const BRIEF_TTL_MS = 4 * 60 * 60 * 1000;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────

export async function getIntelligenceBrief() {
  try {
    const data = await redis.get(INTELLIGENCE_KEY);
    return data?.brief ?? null;
  } catch (err) {
    console.warn("[trends] getIntelligenceBrief failed:", err.message);
    return null;
  }
}

export async function runTrendIntelligence() {
  // Check if recent brief exists — avoid redundant AI calls
  try {
    const existing = await redis.get(INTELLIGENCE_KEY);
    if (existing?.createdAt) {
      const age = Date.now() - new Date(existing.createdAt).getTime();
      if (age < BRIEF_TTL_MS) {
        console.log(`[trends] Brief is ${Math.round(age / 60000)}min old — skipping regeneration`);
        return { ...existing, skipped: true };
      }
    }
  } catch (err) {
    console.warn("[trends] Cache check failed:", err.message);
  }

  const [snapshot, liveSignals] = await Promise.all([
    fetchResourceSnapshot().catch(err => {
      console.warn("[trends] fetchResourceSnapshot failed:", err.message);
      return { tools: [], projects: [], resources: [], blogs: [] };
    }),
    fetchLiveSignals(),
  ]);

  let brief;
  try {
    brief = openai
      ? await generateAITrendBrief(snapshot, liveSignals)
      : buildFallbackBrief(snapshot);
  } catch (err) {
    console.error("[trends] AI brief generation failed:", err.message);
    brief = buildFallbackBrief(snapshot);
  }

  const payload = {
    brief,
    source:    openai ? "openai+live" : "fallback",
    signals:   liveSignals.length,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis.set(INTELLIGENCE_KEY, payload);
    console.log(`[trends] Brief generated — ${liveSignals.length} live signals ingested`);
  } catch (err) {
    console.error("[trends] Failed to cache brief:", err.message);
  }

  return payload;
}

// ─────────────────────────────────────────────────────────────
// LIVE SIGNAL FETCHING
// ─────────────────────────────────────────────────────────────

async function fetchLiveSignals() {
  const [hnStories, devtoArticles] = await Promise.allSettled([
    fetchHackerNews(),
    fetchDevTo(),
  ]);

  const signals = [
    ...(hnStories.status     === "fulfilled" ? hnStories.value     : []),
    ...(devtoArticles.status === "fulfilled" ? devtoArticles.value : []),
  ];

  if (hnStories.status     === "rejected") console.warn("[trends] HN fetch failed:", hnStories.reason?.message);
  if (devtoArticles.status === "rejected") console.warn("[trends] Dev.to fetch failed:", devtoArticles.reason?.message);

  return signals.slice(0, 20);
}

async function fetchHackerNews() {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=15",
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error(`HN API returned ${res.status}`);
  const data = await res.json();
  return (data.hits ?? [])
    .filter(h => isDevRelevant(h.title))
    .slice(0, 10)
    .map(h => ({
      title:  h.title,
      source: "HackerNews",
      url:    h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    }));
}

async function fetchDevTo() {
  const res = await fetch(
    "https://dev.to/api/articles?top=1&per_page=15",
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error(`Dev.to API returned ${res.status}`);
  const data = await res.json();
  return (data ?? [])
    .filter(a => isDevRelevant(a.title))
    .slice(0, 10)
    .map(a => ({
      title:  a.title,
      source: "Dev.to",
      url:    a.url,
    }));
}

const DEV_KEYWORDS = [
  "react", "next", "javascript", "typescript", "css", "node", "api",
  "performance", "web", "frontend", "backend", "database", "ai", "llm",
  "gpt", "claude", "automation", "infrastructure", "cloud", "vercel",
  "supabase", "redis", "deploy", "build", "framework", "library",
  "open source", "github", "developer", "engineering", "architecture",
  "shopify", "commerce", "saas", "startup", "software", "code", "rust",
  "python", "golang", "security", "auth", "serverless", "edge",
];

function isDevRelevant(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return DEV_KEYWORDS.some(kw => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────
// AI BRIEF GENERATION
// ─────────────────────────────────────────────────────────────

async function generateAITrendBrief(snapshot, liveSignals) {
  const recentBlogs = (snapshot.blogs ?? [])
    .slice(-5)
    .map((b, i) => `${i + 1}. ${b.title}: ${b.summary}`)
    .join("\n");

  const toolList = (snapshot.tools ?? [])
    .map((t, i) => `${i + 1}. ${t.name}: ${t.description}`)
    .join("\n");

  const projectList = (snapshot.projects ?? [])
    .map((p, i) => `${i + 1}. ${p.name}: ${p.description}`)
    .join("\n");

  const signalList = liveSignals.length > 0
    ? liveSignals.map(s => `- [${s.source}] ${s.title}`).join("\n")
    : "No live signals available — use brand assets only.";

  const response = await openai.chat.completions.create({
    model:       "gpt-4o-mini",
    max_tokens:  400,
    temperature: 0.7,
    messages: [
      {
        role:    "system",
        content: `You write internal strategy briefs for a senior developer content engine.
The brand is Rebel Designs — a South African digital infrastructure studio.
Audience: developers, technical founders, CTOs, engineers.
Voice: sharp, direct, technical. No marketing language. No exclamation marks. No fluff.
The brief informs what to write about today — it is not consumer-facing content.`,
      },
      {
        role:    "user",
        content: `Write a content intelligence brief for the next 24 hours.

LIVE SIGNALS — what the developer world is discussing right now:
${signalList}

BRAND ASSETS — what Rebel Designs has built and written:
BLOGS: ${recentBlogs || "None"}
TOOLS: ${toolList || "None"}
PROJECTS: ${projectList || "None"}

Output — plain text, no markdown, no bullet symbols, just line breaks:

MOMENTUM: One sentence connecting a live signal to a brand asset. Where do they intersect today?

ANGLE 1 (Contrarian): Challenge a widely-held belief in the dev community. Specific enough to be debatable.
ANGLE 2 (Breakdown): Explain how something technical actually works under the hood. Reference a live signal or brand asset.
ANGLE 3 (Hidden Cost): Expose an invisible cost or trade-off that founders or operators miss until it is too late.

HOOK A: One opening line a senior engineer would actually write. Direct statement. No questions. No exclamation marks.
HOOK B: A second opening line. Provocative but technically defensible. Different sentence structure from Hook A.

Rules:
- Each angle must be genuinely different in structure — no three variations of the same point
- Prioritise live signals that intersect with: infrastructure, AI systems, performance, commerce
- Never use: "unlock", "discover", "game-changer", "it's no secret", "in today's landscape"
- Write like a technical strategist briefing a content team`,
      },
    ],
  });

  return response.choices[0].message.content?.trim() ?? buildFallbackBrief(snapshot);
}

// ─────────────────────────────────────────────────────────────
// FALLBACK BRIEF
// ─────────────────────────────────────────────────────────────

function buildFallbackBrief(snapshot) {
  const recentTitle = snapshot.blogs?.slice(-1)[0]?.title ?? "performance engineering";
  const tool        = snapshot.tools?.[0]?.name           ?? "Password Roast";
  const project     = snapshot.projects?.[0]?.name        ?? "infrastructure work";

  return [
    `MOMENTUM: ${recentTitle} connects directly to what developers are shipping right now — post the architectural decision, not the outcome.`,
    `ANGLE 1 (Contrarian): Most developers treat ${tool.toLowerCase()} as a UI concern. It is a security architecture decision.`,
    `ANGLE 2 (Breakdown): The ${project} works because of one specific mechanism most teams skip. Break down exactly what that is.`,
    "ANGLE 3 (Hidden Cost): Operators pay for infrastructure decisions they cannot see. The cost compounds invisibly until it does not.",
    `HOOK A: ${tool} runs entirely client-side. Most developers would have built it the other way.`,
    "HOOK B: The difference between a website and a system is not visible at launch. It becomes visible at scale.",
  ].join("\n");
}
