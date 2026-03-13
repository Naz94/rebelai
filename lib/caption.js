// ============================================================
// REBEL ENGINE — Caption Generator (lib/caption.js)
//
// Takes an uploaded image + optional brief from the dashboard.
// Uses GPT-4o Vision to extract developer-relevant context from
// the image, then feeds that into the standard brand system
// prompt to generate platform-specific captions.
//
// Image types expected: screenshots, builds, process shots, client work.
// ============================================================

import OpenAI from "openai";
import { BRAND_SYSTEM_PROMPT, PLATFORM_INSTRUCTIONS } from "./brand.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function requireOpenAI() {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  return openai;
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export async function generateCaptionFromImage({
  imageBuffer,
  imageMimeType = "image/jpeg",
  hook         = "",
  context      = "",
  angle        = "",
  rotationType = "value",
  platforms    = "both",
}) {
  const client = requireOpenAI();

  // ── Step 1: Vision analysis (skipped if no image provided) ─
  let analysis = null;
  if (imageBuffer) {
    analysis = await analyseImage(client, imageBuffer, imageMimeType, { hook, context, angle, rotationType });
    console.log(`[caption] Vision analysis complete: ${analysis.subject}`);
  } else {
    console.log("[caption] No image provided — generating from brief only");
    analysis = {
      subject:          hook || context || "Custom brief",
      imageType:        "none",
      technicalDetails: [],
      storyMoments:     [],
      suggestedFocus:   hook || context || "Technical insight from brief",
      platform:         "",
    };
  }

  // ── Step 2: Build custom rotation brief ──────────────────
  const rotation = buildCustomRotation({ analysis, hook, context, angle, rotationType });

  // ── Step 3: Generate captions per platform ───────────────
  const targetPlatforms = platforms === "facebook"  ? ["facebook"]
                        : platforms === "instagram" ? ["instagram"]
                        : ["facebook", "instagram"];

  const copy = {};
  for (const platform of targetPlatforms) {
    copy[platform] = await generateCaption(client, rotation, platform, analysis);
  }

  // ── Step 4: Extract topic ────────────────────────────────
  const topicSource = copy.facebook ?? copy.instagram ?? "";
  const topic       = await extractTopic(client, topicSource);

  return { copy, topic, analysis };
}

// ─────────────────────────────────────────────────────────────
// VISION ANALYSIS
// GPT-4o reads the image and returns structured context.
// Extracts: what is shown, technical details, story moments.
// ─────────────────────────────────────────────────────────────

async function analyseImage(client, imageBuffer, mimeType, userBrief) {
  const base64 = imageBuffer.toString("base64");

  const briefContext = [
    userBrief.hook    ? `User's hook idea: "${userBrief.hook}"`       : "",
    userBrief.context ? `User's context: "${userBrief.context}"`      : "",
    userBrief.angle   ? `Desired angle type: ${userBrief.angle}`      : "",
  ].filter(Boolean).join("\n");

  const response = await client.chat.completions.create({
    model:      "gpt-4o",
    max_tokens: 300,
    messages: [{
      role:    "user",
      content: [
        {
          type:       "image_url",
          image_url:  { url: `data:${mimeType};base64,${base64}`, detail: "high" },
        },
        {
          type: "text",
          text: `You are analysing an image for a South African web development studio called Rebel Designs.

Analyse this image and return a JSON object with these fields:
{
  "subject": "one sentence: what is shown in the image",
  "imageType": "screenshot | process_shot | client_project | diagram | other",
  "technicalDetails": ["array of specific technical details visible — stack, tools, UI patterns, code patterns"],
  "storyMoments": ["array of 2-3 specific, concrete observations that could anchor a social post"],
  "suggestedFocus": "the single most interesting or shareable technical insight from this image",
  "platform": "what platform/tool/framework is visible if any"
}

${briefContext ? `Additional context from the user:\n${briefContext}` : ""}

Return ONLY valid JSON. No preamble, no markdown, no explanation.`,
        },
      ],
    }],
  });

  const raw = response.choices[0].message.content?.trim() ?? "{}";
  try {
    const clean = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    return JSON.parse(clean);
  } catch {
    console.warn("[caption] Vision JSON parse failed — using fallback");
    return {
      subject:          "Developer screenshot",
      imageType:        "screenshot",
      technicalDetails: [],
      storyMoments:     [],
      suggestedFocus:   userBrief.hook || "Technical execution and craft",
      platform:         "",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// BUILD CUSTOM ROTATION
// Constructs a rotation-like brief from the vision output + user inputs.
// This plugs into the same generation path as standard rotations.
// ─────────────────────────────────────────────────────────────

function buildCustomRotation({ analysis, hook, context, angle, rotationType }) {
  const technicalContext = analysis.technicalDetails?.length
    ? `Technical details visible: ${analysis.technicalDetails.join(", ")}.`
    : "";

  const storyContext = analysis.storyMoments?.length
    ? `Story moments: ${analysis.storyMoments.join(" | ")}`
    : "";

  const angleInstruction = angle
    ? `Apply this angle type: ${angle}. `
    : "";

  const hookInstruction = hook
    ? `The user's hook idea (use this as the basis for the opening, adapted to brand voice): "${hook}". `
    : "";

  const contextInstruction = context
    ? `Additional context provided: "${context}". `
    : "";

  const closingRule = rotationType === "lab"
    ? "End with a direct CTA to rebeldesigns.co.za."
    : "End with a genuine technical question that invites debate or experience-sharing.";

  return {
    id:   "custom_caption",
    name: "Custom Caption",
    type: rotationType,
    copyPrompt: `Write a social media post based on this image.

WHAT THE IMAGE SHOWS: ${analysis.subject}
${technicalContext}
${storyContext}
SUGGESTED FOCUS: ${analysis.suggestedFocus}
${analysis.platform ? `PLATFORM/TOOL VISIBLE: ${analysis.platform}` : ""}

USER INPUTS:
${hookInstruction}${contextInstruction}${angleInstruction}

RULES:
- The post must be grounded in what is literally visible in the image — do not invent details
- Lead with the most technically interesting or specific observation
- Apply the brand voice: authoritative, opinionated, no padding, no corporate safe talk
- ${closingRule}`,
  };
}

// ─────────────────────────────────────────────────────────────
// CAPTION GENERATION
// Standard brand-voice generation using the custom rotation brief.
// ─────────────────────────────────────────────────────────────

const CAPTION_BANNED_OPENERS = [
  /^here['']s why/i,
  /^in today['']s/i,
  /^it['']s no secret/i,
  /^this image shows/i,
  /^this screenshot shows/i,
  /^this is a/i,
];

async function generateCaption(client, rotation, platform, analysis) {
  const wordLimit = platform === "instagram" ? 110 : 220;

  let copy     = "";
  let attempts = 0;

  do {
    attempts++;

    const response = await client.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: 400,
      messages: [
        { role: "system", content: BRAND_SYSTEM_PROMPT },
        {
          role:    "user",
          content: `${PLATFORM_INSTRUCTIONS[platform]}

${rotation.copyPrompt}

ADDITIONAL RULES FOR CAPTION:
- Do NOT describe the image literally ("This screenshot shows..."). The image speaks for itself.
- Lead with the insight, not the description.
- Every sentence must introduce new information — no padding, no restatement.`,
        },
      ],
    });

    const raw = response.choices[0].message.content?.trim() ?? "";
    copy      = raw
      .replace(/^\s*\[?HASHTAGS\]?\s*:?\s*$/gim, "")
      .replace(/^\s*hashtags\s*:?\s*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const firstLine = copy.split("\n")[0].trim();
    const wordCount = copy.split(/\n(?=#)/)[0].split(/\s+/).filter(Boolean).length;
    const banned    = CAPTION_BANNED_OPENERS.some(p => p.test(firstLine));
    const overLimit = wordCount > wordLimit;

    if (!banned && !overLimit) break;

    if (banned)    console.warn(`[caption] Banned opener on attempt ${attempts} — retrying`);
    if (overLimit) console.warn(`[caption] Word count ${wordCount} > ${wordLimit} on attempt ${attempts} — retrying`);

  } while (attempts < 3);

  return copy;
}

// ─────────────────────────────────────────────────────────────
// TOPIC EXTRACTION
// ─────────────────────────────────────────────────────────────

async function extractTopic(client, copy) {
  if (!copy) return "Custom caption";

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
