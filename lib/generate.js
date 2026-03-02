// ============================================================
// REBEL AI — Content Generation (lib/generate.js)
//
// Temporarily using GPT-4o for copy generation.
// To swap back to Claude when you add Anthropic credit:
//   1. npm install @anthropic-ai/sdk
//   2. Replace the openai.chat.completions.create calls
//      with anthropic.messages.create
//   3. Add ANTHROPIC_API_KEY to your env vars
// ============================================================

import OpenAI from "openai";
import { BRAND_SYSTEM_PROMPT, PLATFORM_INSTRUCTIONS } from "./brand.js";
import { validateAgentInput }                          from "./popia.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────────────────────
// COPY GENERATION — GPT-4o
// ─────────────────────────────────────────────────────────────

export async function generateCopy(rotation, platform, resourceSnapshot, postHistory = [], intelligenceBrief = null) {

  const inputScan = validateAgentInput(rotation, resourceSnapshot);
  if (!inputScan.passed) {
    console.warn(`[generate] POPIA WARNING: Input scan flagged for ${platform} — continuing but logging`);
  }

  const toolList = (resourceSnapshot.tools ?? [])
    .map(t => `- ${t.name}: ${t.description} → ${t.url}`)
    .join("\n");

  const blogList = (resourceSnapshot.blogs ?? [])
    .map(b => `- "${b.title}" (${b.url}): ${b.summary.slice(0, 200)}...`)
    .join("\n");

  const resourceContext = `
VERIFIED SITE CONTENT — use exact URLs, never invent others:

LAB TOOLS:
${toolList || "None currently"}

BLOG POSTS (reference real arguments and data from these):
${blogList || "None currently"}

LOOT VAULT (free assets): rebeldesigns.co.za/resources
MAIN SITE: rebeldesigns.co.za`.trim();

  const historyContext = postHistory.length > 0
    ? `PREVIOUSLY POSTED — DO NOT REPEAT these topics, angles, hooks, or opening lines:
${postHistory.slice(-20).map((p, i) => `${i + 1}. [${p.rotation}] ${p.topic}`).join("\n")}

Choose a completely fresh angle, new hook, and different specific insight.`.trim()
    : "No previous posts yet — this is the first post.";

  const freshnessDirective = `FRESHNESS RULES — non-negotiable:
- The opening line must be unlike anything in the post history above
- Do not use the same hook structure twice
- Pick ONE specific, concrete insight — not a broad overview
- The post must feel like it was written today about something specific`.trim();

  const trendContext = intelligenceBrief
    ? `CURRENT TREND INTELLIGENCE:\n${intelligenceBrief}`
    : "";

  const response = await openai.chat.completions.create({
    model:      "gpt-4o",
    max_tokens: 1024,
    messages: [
      {
        role:    "system",
        content: BRAND_SYSTEM_PROMPT,
      },
      {
        role:    "user",
        content: `${PLATFORM_INSTRUCTIONS[platform]}

${resourceContext}

${historyContext}

${freshnessDirective}

${trendContext}

Content brief:
${rotation.copyPrompt}`,
      },
    ],
  });

  return response.choices[0].message.content.trim();
}

// ─────────────────────────────────────────────────────────────
// TOPIC EXTRACTION — GPT-4o
// ─────────────────────────────────────────────────────────────

export async function extractTopic(copy) {
  const response = await openai.chat.completions.create({
    model:      "gpt-4o",
    max_tokens: 60,
    messages: [{
      role:    "user",
      content: `Summarise this social media post as a single topic description, max 12 words. Just the topic, no preamble:\n\n${copy}`,
    }],
  });
  return response.choices[0].message.content.trim();
}

// ─────────────────────────────────────────────────────────────
// IMAGE GENERATION — DALL-E 3
// ─────────────────────────────────────────────────────────────

export async function generateImage(rotation) {
  const response = await openai.images.generate({
    model:   "dall-e-3",
    prompt:  rotation.imagePrompt,
    n:       1,
    size:    "1024x1024",
    quality: "standard",
    style:   "vivid",
  });
  return response.data[0].url;
}

// ─────────────────────────────────────────────────────────────
// IMAGE DOWNLOAD — Buffer for API uploads
// ─────────────────────────────────────────────────────────────

export async function downloadImage(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}
