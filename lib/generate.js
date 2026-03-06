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
import { pickAngle, pickHookStyle }                    from "./rotations.js";
import { getHookWeights }                              from "./performance.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────────────────────
// COPY GENERATION — GPT-4o
// ─────────────────────────────────────────────────────────────

function requireOpenAI() {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  return openai;
}

export async function generateCopy(rotation, platform, resourceSnapshot, postHistory = [], intelligenceBrief = null, overrides = {}) {

  const inputScan = validateAgentInput(rotation, resourceSnapshot);
  if (!inputScan.passed) {
    console.warn(`[generate] POPIA WARNING: Input scan flagged for ${platform} — continuing but logging`);
  }

  // ── Angle + hook injection ──────────────────────────────
  // Accept pre-picked values from fire.js (so they can be stored on the draft
  // and flow back into the feedback loop via registerPublishedPost).
  // When called standalone (e.g. regenerate action), picks fresh values using
  // hook weights to bias toward styles that have driven higher engagement.
  const hookWeights = overrides.hookStyle ? {} : await getHookWeights().catch(() => ({}));
  const angle       = overrides.angle     ?? pickAngle(rotation);
  const hookStyle   = overrides.hookStyle ?? pickHookStyle(rotation, hookWeights);

  // ── Build user prompt ───────────────────────────────────
  const userPrompt = buildUserPrompt({
    rotation,
    platform,
    resourceSnapshot,
    postHistory,
    intelligenceBrief,
    angle,
    hookStyle,
  });

  // ── Generate with quality gate (up to 3 attempts) ───────
  const client = requireOpenAI();
  let copy     = "";
  let attempts = 0;

  do {
    attempts++;

    const response = await client.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: 350,           // Facebook ≤280w, Instagram ≤120w — 350 tokens is sufficient
      messages: [
        { role: "system", content: BRAND_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
    });

    const raw = response.choices[0].message.content?.trim() ?? "";
    copy      = normaliseHashtagOutput(raw);

    if (passesQualityGate(copy, platform) && passesHallucinationCheck(copy)) break;

    console.warn(`[generate] Attempt ${attempts} failed quality/hallucination check — retrying`);
  } while (attempts < 3);

  if (attempts === 3) {
    console.warn("[generate] WARNING: Post passed max attempts without clearing all checks — using last output");
  }

  return { copy, hookStyle };
}

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

function buildUserPrompt({ rotation, platform, resourceSnapshot, postHistory, intelligenceBrief, angle, hookStyle }) {

  // ── Resource context ─────────────────────────────────────
  const toolList = (resourceSnapshot.tools ?? [])
    .map(t => formatResource(t))
    .join("\n\n");

  const projectList = (resourceSnapshot.projects ?? [])
    .map(p => formatResource(p))
    .join("\n\n");

  const resourceContext = `
VERIFIED SITE CONTENT — use exact URLs and exact terminology, never invent or paraphrase:

LAB TOOLS:
${toolList || "None currently"}

INFRASTRUCTURE PROJECTS:
${projectList || "None currently"}

RESOURCES:
${(resourceSnapshot.resources ?? []).map(r => {
  const terms = r.antiHallucinationTerms?.length ? `\n  Exact terms: ${r.antiHallucinationTerms.join(", ")}` : "";
  const hooks  = r.contentHooks?.length ? `\n  Hooks:\n${r.contentHooks.map(h => `    - "${h}"`).join("\n")}` : "";
  return `- ${r.name}: ${r.description} → ${r.url}${terms}${hooks}`;
}).join("\n") || "None currently"}

MAIN SITE: rebeldesigns.co.za
INFRASTRUCTURE: rebeldesigns.co.za/Infrastructure
RESOURCES: rebeldesigns.co.za/resources`.trim();

  // ── Post history (anti-repetition) ──────────────────────
  const historyContext = postHistory.length > 0
    ? `PREVIOUSLY POSTED — DO NOT REPEAT these topics, angles, hooks, or opening lines:
${postHistory.slice(-20).map((p, i) => `${i + 1}. [${p.rotation}] ${p.topic}`).join("\n")}

Choose a completely fresh angle, new hook, and different specific insight.`.trim()
    : "No previous posts yet — this is the first post.";

  const freshnessDirective = `FRESHNESS RULES — non-negotiable:
- The opening line must be unlike anything in the post history above
- Do not use the same hook structure twice
- Pick ONE specific, concrete insight — not a broad overview
- The post must feel written today about something specific`.trim();

  // ── Trend context ────────────────────────────────────────
  const trendContext = intelligenceBrief
    ? `CURRENT TREND INTELLIGENCE:\n${intelligenceBrief}`
    : "";

  // ── Angle + hook directive ───────────────────────────────
  const angleDirective = `ANGLE FOR THIS POST: ${angle}
HOOK STYLE FOR THIS POST: ${hookStyle}

Use the angle to determine WHAT specific insight to build the post around.
Use the hook style to determine HOW to open the first sentence.
The opening line must embody this hook style — do not save it for later in the post.`;

  // ── Quality reminders ────────────────────────────────────
  const qualityReminder = `QUALITY REQUIREMENTS:
- Do NOT open with: "In today's", "It's no secret", "Unlock", "Dive deep", or any filler phrase
- Do NOT include invented URLs — only use the exact URLs from the verified content above
- Do NOT paraphrase project names — use the antiHallucinationTerms exactly
- The post must include at least one specific mechanism or architectural insight (depth rule)
- The post must contain at least one idea worth saving (saveable insight rule)
- Return ONLY the post copy — no preamble, no labels, no quotes around it`;

  return [
    PLATFORM_INSTRUCTIONS[platform],
    resourceContext,
    historyContext,
    freshnessDirective,
    trendContext,
    angleDirective,
    qualityReminder,
    `Content brief:\n${rotation.copyPrompt}`,
  ].filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// RESOURCE FORMATTER
// Serialises a project/tool's rich fields for prompt injection.
// ─────────────────────────────────────────────────────────────

function formatResource(r) {
  const lines = [`- ${r.name} [${r.status ?? ""}] (${r.url}): ${r.description}`];

  if (r.architectureHighlights?.length) {
    lines.push(`  Architecture:\n${r.architectureHighlights.map(a => `    - ${a}`).join("\n")}`);
  }
  if (r.authoritySignals?.length) {
    lines.push(`  Authority signals:\n${r.authoritySignals.map(a => `    - ${a}`).join("\n")}`);
  }
  if (r.technicalDepth?.length) {
    lines.push(`  Technical depth: ${r.technicalDepth.join(", ")}`);
  }
  if (r.topicSignals?.length) {
    lines.push(`  Topic signals: ${r.topicSignals.join(", ")}`);
  }
  if (r.audienceTargets?.length) {
    lines.push(`  Audience: ${r.audienceTargets.join(", ")}`);
  }
  if (r.antiHallucinationTerms?.length) {
    lines.push(`  Exact terms (use verbatim): ${r.antiHallucinationTerms.join(", ")}`);
  }
  if (r.storyMoments?.length) {
    lines.push(`  Story moments:\n${r.storyMoments.map(s => `    - ${s}`).join("\n")}`);
  }
  if (r.contentHooks?.length) {
    lines.push(`  Content hooks:\n${r.contentHooks.map(h => `    - "${h}"`).join("\n")}`);
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// QUALITY GATE
// Rejects posts that contain known failure patterns.
// Returns true if the post passes (good to use).
// ─────────────────────────────────────────────────────────────

const BANNED_OPENERS = [
  /^in today['']s digital landscape/i,
  /^it['']s no secret/i,
  /^unlock your/i,
  /^dive deep/i,
  /^as developers/i,
  /^in the (ever[-\s])?evolving/i,
  /^here is your post/i,
  /^here['']s your post/i,
];

const BANNED_PHRASES = [
  "it's no secret",
  "unlock your potential",
  "unlock the",
  "revolutionize",
  "dive deep",
  "in today's digital landscape",
  "game-changer",
  "changes the game",
  "change the game",
  "\u2014",                          // em-dash — use short sentences instead
  "the saveable insight:",      // model labelling its own insight
  "saveable insight:",
  "echoes through",             // filler opener
  "it goes without saying",
  "discover how",               // consumer CTA language
  "discover more",
  "discover what",
  "explore how rebel designs",  // third-person self-reference
  "rebel designs'",             // third-person possessive
  "rebel designs is proof",     // third-person brand claim
  "choose layered",             // tagline/ad language
  "not merely",                 // hedging
  "it's engineered",            // weak closer
  "trust isn't given",          // cliché
];

function passesQualityGate(copy, platform = "facebook") {
  if (!copy || copy.length < 80) return false;

  const firstLine = copy.split("\n")[0].trim();

  for (const pattern of BANNED_OPENERS) {
    if (pattern.test(firstLine)) return false;
  }

  for (const phrase of BANNED_PHRASES) {
    if (copy.toLowerCase().includes(phrase)) return false;
  }

  // ── Word count ceiling ────────────────────────────────────
  // Count words in body only — split before first hashtag line.
  const bodyOnly  = copy.split(/\n(?=#)/)[0].trim();
  const wordCount = bodyOnly.split(/\s+/).filter(Boolean).length;
  const wordLimit = platform === "instagram" ? 110 : 220;
  if (wordCount > wordLimit) {
    console.warn(`[generate] Word count ${wordCount} exceeds ${wordLimit} for ${platform} — retrying`);
    return false;
  }

  // ── Hashtag count (Instagram only) ───────────────────────
  // Prompt asks for 25. Allow 23–26 as tolerance.
  if (platform === "instagram") {
    const hashtagMatches = copy.match(/#[\w]+/g) ?? [];
    if (hashtagMatches.length < 23 || hashtagMatches.length > 26) {
      console.warn(`[generate] Instagram hashtag count ${hashtagMatches.length} out of range (23–26) — retrying`);
      return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// HALLUCINATION FIREWALL
// Rejects posts that contain invented URLs.
// Allows only known Rebel Designs and Password Roast URLs.
// Returns true if the post passes (no hallucinated links).
// ─────────────────────────────────────────────────────────────

const ALLOWED_URL_PATTERNS = [
  /rebeldesigns\.co\.za/,
  /passwordroast\.netlify\.app/,
  /gamesir\.co\.za/,
];

function passesHallucinationCheck(copy) {
  const urlPattern = /https?:\/\/[^\s)>\]"']+/gi;
  const urls       = copy.match(urlPattern) ?? [];

  for (const url of urls) {
    const isAllowed = ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
    if (!isAllowed) {
      console.warn(`[generate] Hallucination detected: invented URL "${url}"`);
      return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// NORMALISE HASHTAG OUTPUT
// ─────────────────────────────────────────────────────────────

function normaliseHashtagOutput(copy) {
  return copy
    .replace(/^\s*\[?HASHTAGS\]?\s*:?\s*$/gim, "")
    .replace(/^\s*hashtags\s*:?\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// TOPIC EXTRACTION — GPT-4o-mini
// Cheaper model is fine for a 12-word summary.
// ─────────────────────────────────────────────────────────────

export async function extractTopic(copy) {
  const client = requireOpenAI();

  const response = await client.chat.completions.create({
    model:      "gpt-4o-mini",
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
  const client = requireOpenAI();

  const response = await client.images.generate({
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
