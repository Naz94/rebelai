// ============================================================
// REBEL ENGINE — Trend Intelligence (lib/trends.js)
//
// Fetches live signals and generates a daily content brief.
// Audience: SME owners, e-commerce founders, service businesses
// in South Africa. Brief informs SME-facing post angles.
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
      return { tools: [], projects: [], resources: [], brandFacts: {} };
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
    .filter(h => isSMERelevant(h.title))
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
    .filter(a => isSMERelevant(a.title))
    .slice(0, 10)
    .map(a => ({
      title:  a.title,
      source: "Dev.to",
      url:    a.url,
    }));
}

// ─────────────────────────────────────────────────────────────
// SIGNAL RELEVANCE FILTER
// Keeps signals that are useful for SME-facing content.
// Dev-only topics (CVEs, React internals, Rust, WASM) are excluded.
// Topics that affect business owners indirectly are included.
// ─────────────────────────────────────────────────────────────

const SME_KEYWORDS = [
  // Business & commerce
  "small business", "ecommerce", "e-commerce", "online store", "shopify",
  "payment", "paystack", "checkout", "invoice", "quote", "pricing",
  "freelance", "agency", "client", "startup", "founder", "entrepreneur",
  "revenue", "sales", "customer", "marketing", "advertising", "social media",

  // Automation & AI tools for business
  "automation", "chatbot", "whatsapp", "ai tool", "ai agent", "workflow",
  "no-code", "low-code", "zapier", "make", "n8n", "scheduling",
  "content generation", "social media automation", "instagram", "facebook",

  // Website & digital presence
  "website", "landing page", "seo", "google", "web design", "mobile",
  "hosting", "domain", "wordpress", "squarespace", "wix", "webflow",
  "page speed", "performance", "analytics",

  // South African / African market
  "south africa", "africa", "cape town", "johannesburg", "african",
  "rand", "zar", "popi", "popia",

  // Fraud & security topics a business owner would care about
  "fraud", "scam", "phishing", "payment fraud", "identity", "hack",
  "data breach", "password", "security tip",

  // General business operations
  "productivity", "remote work", "hiring", "outsource", "email",
  "crm", "lead generation", "follow up", "onboarding",
];

function isSMERelevant(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return SME_KEYWORDS.some(kw => lower.includes(kw));
}

// ─────────────────────────────────────────────────────────────
// AI BRIEF GENERATION
// ─────────────────────────────────────────────────────────────

async function generateAITrendBrief(snapshot, liveSignals) {
  const projectList = (snapshot.projects ?? [])
    .map((p, i) => `${i + 1}. ${p.name}: ${p.businessProblem ?? p.description}`)
    .join("\n");

  const toolList = (snapshot.tools ?? [])
    .map((t, i) => `${i + 1}. ${t.name}: ${t.businessProblem ?? t.description}`)
    .join("\n");

  const brandFacts = snapshot.brandFacts ?? {};

  const signalList = liveSignals.length > 0
    ? liveSignals.map(s => `- [${s.source}] ${s.title}`).join("\n")
    : "No live signals matched today — use brand assets and business owner pain points only.";

  const response = await openai.chat.completions.create({
    model:       "gpt-4o-mini",
    max_tokens:  400,
    temperature: 0.7,
    messages: [
      {
        role:    "system",
        content: `You write internal content strategy briefs for a social media content engine.
The brand is Rebel Designs — a South African web studio that builds websites, online stores, and AI automation tools for small and medium businesses.
The audience for all content is South African business owners: restaurant owners, retailers, service businesses, e-commerce sellers, tradespeople.
They are not technical. They are busy. They want to grow their business and not get ripped off.
Voice: direct, warm, plain language. No jargon. No developer-speak. No exclamation marks. No marketing fluff.
The brief informs what to write about today — it is not consumer-facing content itself.`,
      },
      {
        role:    "user",
        content: `Write a content intelligence brief for the next 24 hours.

LIVE SIGNALS — what is being discussed online that is relevant to South African business owners:
${signalList}

REBEL DESIGNS SERVICES AND WORK:
${brandFacts.positioning ?? "Websites, online stores, and AI tools for South African businesses."}

Projects built:
${projectList || "None"}

Tools available:
${toolList || "None"}

Output — plain text only, no markdown, no bullet symbols, just line breaks:

MOMENTUM: One sentence connecting a live signal (or a current business reality) to something Rebel Designs solves. Where does the conversation intersect with what business owners actually need?

ANGLE 1 (Business reality): A situation most South African business owners will recognise. Something true about running a business that they have experienced but haven't heard named clearly.
ANGLE 2 (Before and after): What life looks like before solving a specific problem vs after. Pick a concrete problem Rebel Designs solves.
ANGLE 3 (Hidden cost): An invisible cost or risk that business owners don't think about until it is too late. Real and specific — not generic.

HOOK A: One opening line a business owner would stop scrolling for. Plain language. A specific situation or truth they recognise. No questions. No exclamation marks.
HOOK B: A second opening line. Different situation. Different sentence structure. Still plain language. Still specific.

Rules:
- Write for someone who runs a business, not someone who builds software
- Every angle must be about a real business owner situation — not a technology trend
- If no live signals are relevant, ignore them entirely and use brand assets and business owner pain points
- Never use: "unlock", "discover", "game-changer", "transform your business", "in today's landscape", "leverage", "seamlessly"
- No technical jargon whatsoever
- Each angle must be genuinely different — not three versions of the same point`,
      },
    ],
  });

  return response.choices[0].message.content?.trim() ?? buildFallbackBrief(snapshot);
}

// ─────────────────────────────────────────────────────────────
// FALLBACK BRIEF
// Used when OpenAI is unavailable.
// ─────────────────────────────────────────────────────────────

function buildFallbackBrief(snapshot) {
  const project = snapshot.projects?.[0]?.name ?? "an online store";
  const tool    = snapshot.tools?.[0]?.name    ?? "Password Roast";

  return [
    "MOMENTUM: More South African businesses are selling online — but most are still taking orders manually on WhatsApp. That gap is exactly what Rebel Designs closes.",
    "ANGLE 1 (Business reality): Most business owners don't find out they don't own their website until they need to change something and can't reach the person who built it.",
    `ANGLE 2 (Before and after): Before ${project} — orders came in on WhatsApp and had to be processed by hand. After — payments, orders, and fulfilment happen automatically.`,
    "ANGLE 3 (Hidden cost): A website that loads slowly on mobile is losing customers before they see what you sell. Most owners never know it's happening.",
    "HOOK A: Your website is either working for your business right now or it's working against it.",
    `HOOK B: ${tool} is a free tool that checks whether your passwords are actually strong — or just look like they are.`,
  ].join("\n");
}
