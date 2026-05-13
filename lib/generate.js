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
  const rotationType = rotation.type ?? "value";

  const client   = requireOpenAI();
  let copy        = "";
  let attempts    = 0;
  let lastFailure = "";

  do {
    attempts++;

    // On retry: tell the model exactly what failed and lock the topic.
    const retryAnchor = attempts > 1
      ? `\n\nCRITICAL — RETRY ${attempts}: Previous attempt was rejected. Reason: ${lastFailure}. Do NOT use that phrase or pattern. Stay on the same topic: "${angle}". Rewrite completely — different opening sentence, different structure, same subject.`
      : "";

    const response = await client.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: 350,
      messages: [
        { role: "system", content: BRAND_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt + retryAnchor },
      ],
    });

    const raw = response.choices[0].message.content?.trim() ?? "";
    copy      = normaliseHashtagOutput(raw);

    const gateResult = checkQualityGate(copy, platform, rotationType);
    if (gateResult.passed && passesHallucinationCheck(copy)) break;

    lastFailure = gateResult.reason ?? "unknown quality issue";
    console.warn(`[generate] Attempt ${attempts} failed: ${lastFailure}`);
  } while (attempts < 3);

  if (attempts === 3) {
    console.warn(`[generate] WARNING: Max attempts reached — last failure: ${lastFailure} — using last output`);
  }

  return { copy, hookStyle };
}

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

function buildUserPrompt({ rotation, platform, resourceSnapshot, postHistory, intelligenceBrief, angle, hookStyle }) {

  // ── Resource context ─────────────────────────────────────
  // Serialises tools + projects into plain-language context the AI can
  // reference for showcase posts. Uses businessProblem/businessOutcome
  // instead of the old architectureHighlights/technicalDepth fields.
  const toolList = (resourceSnapshot.tools ?? [])
    .map(t => formatResource(t))
    .join("\n\n");

  const projectList = (resourceSnapshot.projects ?? [])
    .map(p => formatResource(p))
    .join("\n\n");

  const brandFacts = resourceSnapshot.brandFacts ?? {};

  const resourceContext = `
VERIFIED SITE CONTENT — use exact names and URLs, never invent or paraphrase:

WHAT REBEL DESIGNS DOES:
${brandFacts.positioning ?? "Websites, online stores, and AI tools for South African businesses."}

Services offered:
${(brandFacts.services ?? []).map(s => `- ${s}`).join("\n")}

Ownership policy: ${brandFacts.ownershipPolicy ?? ""}
South African context: ${brandFacts.southAfricanContext ?? ""}

TOOLS:
${toolList || "None currently"}

PROJECTS & WORK:
${projectList || "None currently"}

RESOURCES:
${(resourceSnapshot.resources ?? []).map(r => {
  const terms = r.antiHallucinationTerms?.length ? `\n  Exact names/URLs: ${r.antiHallucinationTerms.join(", ")}` : "";
  const hooks  = r.contentHooks?.length ? `\n  Hooks:\n${r.contentHooks.map(h => `    - "${h}"`).join("\n")}` : "";
  return `- ${r.name}: ${r.description} -> ${r.url}${terms}${hooks}`;
}).join("\n") || "None currently"}

MAIN SITE: rebeldesigns.co.za
RESOURCES: rebeldesigns.co.za/resources`.trim();

  // ── Post history (anti-repetition) ──────────────────────
  const historyContext = postHistory.length > 0
    ? `PREVIOUSLY POSTED — DO NOT REPEAT these topics, angles, or opening lines:
${postHistory.slice(-20).map((p, i) => `${i + 1}. [${p.rotation}] ${p.topic}`).join("\n")}

Choose a completely fresh angle and different opening.`.trim()
    : "No previous posts yet — this is the first post.";

  const freshnessDirective = `FRESHNESS RULES — non-negotiable:
- The opening line must be unlike anything in the post history above
- Do not use the same hook structure twice in a row
- Pick ONE specific, concrete situation or insight — not a broad overview
- The post must feel like it was written today about something real`.trim();

  // ── Trend context ────────────────────────────────────────
  const trendContext = intelligenceBrief
    ? `CURRENT TREND INTELLIGENCE:\n${intelligenceBrief}`
    : "";

  // ── Angle + hook directive ───────────────────────────────
  const angleDirective = `ANGLE FOR THIS POST: ${angle}
HOOK STYLE: ${hookStyle}

Write in the EXACT voice of the worked examples in your system prompt.
- Open with a direct statement of fact, not a question and not a metaphor
- Name a specific situation, not a general category
- State consequences directly ("they leave", "you lose the sale") not as possibilities ("can affect", "may cost you")
- No em-dash, no en-dash, no rhetorical questions, no clichés
- The opening line must be a statement, not a question`;

  // ── Closing instruction varies by rotation type ──────────
  // Value posts MUST end with a question the reader can answer from their own experience.
  // Lab/showcase posts MUST end with a CTA linking to rebeldesigns.co.za.
  const closingRule = rotation.type === "lab"
    ? "- End with a direct, soft CTA — invite them to see more or get in touch. Link to rebeldesigns.co.za. Do NOT end with a question."
    : "- End with a genuine question the reader can answer from their own experience (not a rhetorical question, a real one)";

  // ── Quality reminders ────────────────────────────────────
  const qualityReminder = `STRICT OUTPUT RULES:
- Max ${platform === "instagram" ? "90" : "200"} words in the body (before hashtags)
- No em-dash (—) or en-dash (–) anywhere — use a full stop
- No rhetorical questions mid-post
- No clichés from the banned list in the system prompt
- One idea only — do not summarise or list multiple problems
- Return ONLY the post copy`;

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
// Serialises a project/tool's fields for prompt injection.
// Uses plain-language business fields instead of technical ones.
// ─────────────────────────────────────────────────────────────

function formatResource(r) {
  const lines = [`- ${r.name} [${r.status ?? ""}] (${r.url}): ${r.description}`];

  if (r.businessProblem) {
    lines.push(`  Business problem it solves: ${r.businessProblem}`);
  }
  if (r.businessOutcome) {
    lines.push(`  Business outcome: ${r.businessOutcome}`);
  }
  if (r.storyMoments?.length) {
    lines.push(`  Story moments:\n${r.storyMoments.map(s => `    - ${s}`).join("\n")}`);
  }
  if (r.antiHallucinationTerms?.length) {
    lines.push(`  Exact names/URLs (use verbatim): ${r.antiHallucinationTerms.join(", ")}`);
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
//
// rotationType: "value" | "lab"
//   - "value" posts MUST end with a question
//   - "lab"   posts MUST NOT end with a question (CTA required instead)
// ─────────────────────────────────────────────────────────────

const BANNED_OPENERS = [
  // Generic salesy openers (SME-era failure modes)
  /^are you tired of/i,
  /^running a business (is|can be)/i,
  /^as a business owner/i,
  /^every business owner knows/i,
  /^did you know that/i,
  /^transform your/i,
  /^grow your business/i,
  /^take your business to/i,
  /^in today['']s /i,
  /^it['']s no secret/i,
  /^unlock your/i,
  /^unlock the/i,
  /^dive deep/i,
  // Metaphor/story openers caught in live output
  /^your .{0,40} is more than just/i,
  /^we['']ve all been there/i,
  /^imagine (that|your|a )/i,
  /^think about (it|the|your|a )/i,
  /^does your .{0,40} (leave|send|make|work|look)/i,
  /^picture this/i,
  /^here['']s the thing/i,
  /^scheduling .{0,30} feels like/i,
  /^managing .{0,30} (can|feels|is)/i,
  // Filler openers
  /^here is your post/i,
  /^here['']s your post/i,
  /^here['']s why/i,
  /^the (rise|power|key|secret|truth|reality|problem|answer) of/i,
];

const BANNED_PHRASES = [
  // Generic SME marketing fluff
  "it's no secret",
  "unlock your potential",
  "unlock the",
  "revolutionize",
  "revolutionise",
  "transform your business",
  "grow your business",
  "take your business to the next level",
  "dive deep",
  "in today's digital landscape",
  "in today's digital age",
  "in today's world",
  "in today's market",
  "game-changer",
  "game changer",
  "changes the game",
  "change the game",
  "leverage",
  "cutting-edge",
  "cutting edge",
  "state-of-the-art",
  "best-in-class",
  "industry-leading",
  "world-class",

  // Em-dash and en-dash (brand rule — use full stops instead)
  "\u2014",  // em-dash —
  "\u2013",  // en-dash –

  // Banned from old developer era — kept in case of model bleed-through
  "the saveable insight:",
  "saveable insight:",
  "the architectural lesson",
  "architectural insight",
  "echoes through",
  "it goes without saying",
  "discover how",
  "discover more",
  "discover what",
  "explore how rebel designs",
  "rebel designs'",
  "rebel designs is proof",
  "not merely",
  "mere automation",
  "true intelligence",

  // Structure-narrating phrases
  "here's why:",
  "here's the thing:",
  "consider this:",
  "the real question is",
  "the real culprit",
  "the key lies in",
  "the promise of",

  // Padding caught in live output
  "this isn't just a theoretical",
  "effortlessly",
  "seamlessly",
  "with ease",
  "ensures smooth operations",
  "fundamentally reshaping",
  "redefining scalability",
  "enables you to",
  "empowers you to",
  "allows you to focus on what matters",
  "so you can focus on what matters",
  "without breaking a sweat",
  // New failures from live output
  "is more than just",
  "we've all been there",
  "surprising, right",
  "without losing your voice",
  "juggling the timing",
  "really protected",
  "it's worth checking",
  "automated solutions",
  "valuable time",
  "missing out on customers",
  "keeping their brand",
  "hits hard when you realize",
  "can't afford",
  // Latest live output failures
  "is like having a",
  "it's like having a",
  "like having a",
  "protective measures",
  "are crucial",
  "is crucial",
  "no tech skills needed",
  "didn't even know were there",
  "don't let one slip",
  "slip through your",
  "headache no business",
  "a potential financial hit",
  // trust_process rotation failures
  "stepping into the unknown",
  "make or break your experience",
  "website journey",
  "doesn't have to be a mystery",
  "confidence comes from",
  "without the stress",
  "watch for to stay on track",
  // ai_whatsapp rotation failures
  "freeing your time for things that matter",
  "change everything",
  "pile up fast",
  "focus on the bigger picture",
  "not the other way around",
  "it's time it started",
  "treat whatsapp as",
  "second sales channel",
  // Latest failures — general
  "you're not alone",
  "make all the difference",
  "makes all the difference",
  "keep the conversation flowing",
  "stop losing out",
  "what truly needs your attention",
  "all night long",
  "without you lifting a finger",
  "lifting a finger",
  "it's not just about being",
  // Rhetorical questions and mid-post patterns
  "sounds like a dream",
  "but what if you",
  "but what if the",
  "what if the inquiries",
  "imagine handling",
  "imagine automating",
  "imagine if your",
  // Weak closings and padding
  "without a hitch",
  "long after the doors close",
  "hardly working",
  "working hard or hardly",
  "showing off what you offer",
  "think about it",
];

// Detects posts that end with a question.
// Checks the last non-empty, non-hashtag line.
function endsWithQuestion(copy) {
  const lines = copy.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const lastLine = lines[lines.length - 1] ?? "";
  return lastLine.endsWith("?");
}

function checkQualityGate(copy, platform = "facebook", rotationType = "value") {
  const fail = (reason) => ({ passed: false, reason });

  if (!copy || copy.length < 80) return fail("copy too short");

  const firstLine = copy.split("\n")[0].trim();

  for (const pattern of BANNED_OPENERS) {
    if (pattern.test(firstLine)) return fail(`banned opener matched: "${firstLine.slice(0, 60)}"`);
  }

  for (const phrase of BANNED_PHRASES) {
    if (copy.toLowerCase().includes(phrase.toLowerCase())) return fail(`banned phrase: "${phrase}"`);
  }

  if (rotationType === "lab" && endsWithQuestion(copy)) {
    return fail("lab post ends with question — needs CTA instead");
  }

  const bodyOnly  = copy.split(/\n(?=#)/)[0].trim();
  const wordCount = bodyOnly.split(/\s+/).filter(Boolean).length;
  const wordLimit = platform === "instagram" ? 100 : 200;
  if (wordCount > wordLimit) return fail(`word count ${wordCount} exceeds ${wordLimit}`);

  if (platform === "instagram") {
    const hashtagMatches = copy.match(/#[\w]+/g) ?? [];
    if (hashtagMatches.length < 23 || hashtagMatches.length > 26) {
      return fail(`hashtag count ${hashtagMatches.length} not in range 23-26`);
    }
    // Duplicate hashtag check
    const tagSet = new Set(hashtagMatches.map(t => t.toLowerCase()));
    if (tagSet.size !== hashtagMatches.length) {
      return fail(`duplicate hashtags detected`);
    }
    // Run-together hashtag check — ##tag or #tag#tag
    if (/#[\w]+#/i.test(copy)) {
      return fail(`run-together hashtags detected — hashtags must be space-separated`);
    }
  }

  const sentences = copy
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 20 && !s.startsWith("#"));

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const wordsA = sentences[i].split(" ");
      const wordsB = new Set(sentences[j].split(" "));
      const shared = wordsA.filter(w => w.length > 4 && wordsB.has(w));
      if (shared.length >= 5) {
        return fail(`repetition: "${sentences[i].slice(0, 50)}" echoes "${sentences[j].slice(0, 50)}"`);
      }
    }
  }

  return { passed: true, reason: null };
}

// ─────────────────────────────────────────────────────────────
// HALLUCINATION FIREWALL
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
// IMAGE GENERATION — gpt-image-1
// Returns { buffer: Buffer, mimeType: string }
// gpt-image-1 returns base64 by default — no URL available.
// visual.js consumes the buffer directly and uploads to Blob.
// ─────────────────────────────────────────────────────────────

export async function generateImage(rotation) {
  const client = requireOpenAI();

  const response = await client.images.generate({
    model:   "gpt-image-1",
    prompt:  rotation.imagePrompt,
    n:       1,
    size:    "1024x1024",
    quality: "medium",
  });

  const b64 = response.data[0].b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  return {
    buffer:   Buffer.from(b64, "base64"),
    mimeType: "image/png",
  };
}

// ─────────────────────────────────────────────────────────────
// IMAGE DOWNLOAD — Buffer for API uploads
// Still used by post.js for re-fetching Blob URLs if needed.
// ─────────────────────────────────────────────────────────────

export async function downloadImage(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}
