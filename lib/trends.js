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

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content: "You create concise social content trend briefs for a premium South African web design brand.",
      },
      {
        role: "user",
        content: `Create a compact trend brief for next 24h content planning.\n\nRecent blogs:\n${recentBlogs || "None"}\n\nTools and products:\n${toolList || "None"}\n\nOutput format:\n- One short momentum statement\n- 3 trend bullets\n- 2 hook ideas` ,
      },
    ],
  });

  return response.choices[0].message.content?.trim() ?? buildFallbackBrief(snapshot);
}

function buildFallbackBrief(snapshot) {
  const recentTitle = snapshot.blogs?.slice(-1)[0]?.title ?? "latest site update";
  const tool = snapshot.tools?.[0]?.name ?? "core web performance expertise";

  return [
    `Momentum: Lean into practical, proof-based content tied to ${recentTitle}.`,
    "Trend 1: Demonstrate measurable before/after outcomes (speed, bounce, conversion).",
    "Trend 2: Contrast premium build quality versus long-term platform lock-in costs.",
    `Trend 3: Use interactive proof points from ${tool} to make technical quality tangible.`,
    "Hook idea: 'Your slow website is costing trust before your offer is even read.'",
    "Hook idea: 'Cheap now, expensive forever: the hidden bill behind template stacks.'",
  ].join("\n");
}
