// ============================================================
// REBEL ENGINE — Trend Intelligence (lib/trends.js)
//
// Builds a short "what to write about now" brief and stores it in Redis.
// Draft generation can inject this brief to keep messaging current.
// ============================================================

import OpenAI from "openai";
import { Redis } from "@upstash/redis";
import { fetchResourceSnapshot } from "./resources.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const INTELLIGENCE_KEY = "rebelai:intelligence_brief";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function getIntelligenceBrief() {
  const data = await redis.get(INTELLIGENCE_KEY);
  return data?.brief ?? null;
}

export async function runTrendIntelligence() {
  const snapshot = await fetchResourceSnapshot();

  const brief = openai
    ? await generateAITrendBrief(snapshot)
    : buildFallbackBrief(snapshot);

  const payload = {
    brief,
    source: openai ? "openai" : "fallback",
    createdAt: new Date().toISOString(),
  };

  await redis.set(INTELLIGENCE_KEY, payload);

  return payload;
}

async function generateAITrendBrief(snapshot) {
  const recentBlogs = (snapshot.blogs ?? [])
    .slice(-5)
    .map((b, i) => `${i + 1}. ${b.title}: ${b.summary}`)
    .join("\n");

  const toolList = (snapshot.tools ?? [])
    .map((tool, i) => `${i + 1}. ${tool.name}: ${tool.description}`)
    .join("\n");

  const projectList = (snapshot.projects ?? [])
    .map((p, i) => `${i + 1}. ${p.name}: ${p.description}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You write internal strategy briefs for a senior developer content engine.
The brand is Rebel Designs — a South African digital infrastructure studio.
Audience: developers, technical founders, CTOs, engineers.
Voice: sharp, direct, technical. No marketing language. No exclamation marks. No fluff.
The brief informs what to write about today — it is not consumer-facing content.`,
      },
      {
        role: "user",
        content: `Write a content intelligence brief for the next 24 hours.

Brand assets available:
BLOGS: ${recentBlogs || "None"}
TOOLS: ${toolList || "None"}
PROJECTS: ${projectList || "None"}

Output format — plain text, no markdown bold, no bullet symbols, just line breaks:

MOMENTUM: One sentence on what technical topic has the most credibility signal right now based on the assets above.

ANGLE 1: A specific technical insight worth posting about today. One sentence. Developer-level specificity.
ANGLE 2: A second distinct angle. Different category from Angle 1.
ANGLE 3: A third angle that speaks to founders or operators, not just developers.

HOOK A: One opening line a senior engineer would actually write. No questions. No exclamation marks. States something direct and true.
HOOK B: A second opening line. Different structure from Hook A. Can be a provocative true statement.

Rules: No marketing language. No "unlock", "discover", "game-changer". No consumer hooks. Write like a technical strategist briefing a content team.`,
      },
    ],
  });

  return response.choices[0].message.content?.trim() ?? buildFallbackBrief(snapshot);
}

function buildFallbackBrief(snapshot) {
  const recentTitle = snapshot.blogs?.slice(-1)[0]?.title ?? "performance engineering";
  const tool        = snapshot.tools?.[0]?.name           ?? "Password Roast";
  const project     = snapshot.projects?.[0]?.name        ?? "infrastructure work";

  return [
    `MOMENTUM: ${recentTitle} has direct credibility signal — post about the technical decisions behind it, not the outcome.`,
    `ANGLE 1: The architectural decision that made ${project} work at scale. One specific mechanism, not a summary.`,
    "ANGLE 2: Why most developers reach for the wrong abstraction first — and the cost of that choice at production scale.",
    "ANGLE 3: Business operators are paying for infrastructure they do not understand. Name the specific cost.",
    `HOOK A: ${tool} was built client-side for one reason. Most developers would have made the opposite call.`,
    "HOOK B: The difference between a website and a system is not visible at launch. It becomes visible at scale.",
  ].join("\n");
}
