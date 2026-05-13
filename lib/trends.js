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
    max_tokens:  450,
    temperature: 0.3,
    messages: [
      {
        role:    "system",
        content: `You write terse internal briefs for a social media content engine. Output only the brief. No preamble. No sign-off. No extra commentary.

Brand: Rebel Designs. South African web studio. Builds websites, online stores, WhatsApp bots, social media agents, and custom AI tools for small businesses.
Brief audience: the content engine — not the public.
Post audience: South African business owners. Restaurant owners. Retailers. Tradespeople. Service businesses. NOT developers. NOT technical people.

Style rules — every line of the brief must follow these:
- Concrete and specific. Name a real situation. Not a general category.
- No hedging words: "can", "might", "could", "often", "many", "some", "feel", "seem"
- No marketing language: "top-of-mind", "what really matters", "free up their time", "effective ways", "grow their business", "missed opportunities", "brand presence"
- No soft openers: "As discussions grow", "In a world where", "Many businesses", "Most business owners juggle"
- No exclamation marks. No questions in hooks.
- Write the way someone would talk in a conversation — direct, plain, a little blunt.

BAD example (do not write like this):
HOOK A: Managing your social media can feel impossible when you're busy running a business.

GOOD example (write like this):
HOOK A: Most business owners haven't posted in three weeks. The page looks abandoned. New customers notice.`,
      },
      {
        role:    "user",
        content: `Write a content intelligence brief for the next 24 hours.

LIVE SIGNALS:
${signalList}

REBEL DESIGNS WORK:
${brandFacts.positioning ?? "Websites, online stores, and AI tools for South African businesses."}
Projects: ${projectList || "None"}
Tools: ${toolList || "None"}

Output format — plain text, no markdown, no symbols, just these labelled lines:

MOMENTUM: One sentence. A specific, concrete situation a business owner is in right now — connected to something Rebel Designs solves. Not a trend observation. A real business moment.

ANGLE 1 (Business reality): Name a specific situation most South African business owners have been in. Concrete. Something they would say "that's me." Not a broad observation.
ANGLE 2 (Before and after): One sentence before, one sentence after. Specific problem. Specific change. No vague outcomes.
ANGLE 3 (Hidden cost): A real, specific cost or risk that most business owners don't see until it hits them. Name the actual consequence — not "missed opportunities" or "potential losses."

HOOK A: One sentence. Describes a specific situation a business owner is in right now. Present tense. No hedging. No questions. No exclamation marks.
HOOK B: One sentence. Different specific situation. Different sentence structure. Same rules.

Strict bans — do not use any of these:
"top-of-mind", "what really matters", "free up their time", "missed opportunities", "keep their brand", "feel impossible", "looking for effective ways", "many businesses", "business owners juggle", "can feel", "might be", "could be", "enjoy a steady", "without daily effort", "connection and sales", "proper tools", "invest in"`,
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
