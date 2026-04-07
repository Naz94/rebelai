// ============================================================
// REBEL AI — Caption Generation (lib/caption.js)
//
// Called by api/agent/caption.js when a user submits an image
// (or hook + context only) via the dashboard caption tool.
//
// Flow:
//   1. If an image buffer is provided, GPT-4o Vision analyses it
//      and extracts developer-relevant context and framing angles.
//   2. A custom rotation brief is built from the vision output
//      and any user-supplied hook, context, and angle.
//   3. generateCopy produces platform-specific copy for each
//      requested platform (facebook, instagram, or both).
//   4. extractTopic produces a short topic label for the draft.
//
// Returns: { topic, copy: { facebook?, instagram? }, analysis }
// ============================================================

import OpenAI from "openai";
import { BRAND_SYSTEM_PROMPT, PLATFORM_INSTRUCTIONS } from "./brand.js";
import { generateCopy, extractTopic }                 from "./generate.js";
import { fetchResourceSnapshot }                      from "./resources.js";
import { getPostedTopics }                            from "./kv.js";
import { getIntelligenceBrief }                       from "./trends.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function requireOpenAI() {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  return openai;
}

// ─────────────────────────────────────────────────────────────
// VISION ANALYSIS
// Sends the image to GPT-4o Vision and returns a structured
// analysis: what the image shows and angles that fit the brand.
// Only called when an image buffer is provided.
// ─────────────────────────────────────────────────────────────

async function analyseImage({ imageBuffer, imageMimeType, hook, context }) {
  const client     = requireOpenAI();
  const base64     = imageBuffer.toString("base64");
  const dataUrl    = `data:${imageMimeType};base64,${base64}`;

  const systemPrompt = `You are a content strategist for Rebel Designs, a South African web development and infrastructure studio. 
Your job is to analyse an image and extract context that will help write a sharp, technically credible social media post.
The brand voice is: direct, opinionated, technical, zero fluff. The audience is developers, technical founders, and operators.
Never invent technical claims. Only describe what is actually visible in the image.`;

  const userPrompt = [
    "Analyse this image for use as a social media post visual.",
    hook    ? `User's hook idea: "${hook}"`       : "",
    context ? `User's context: "${context}"`      : "",
    "",
    "Return a JSON object with these fields:",
    '{',
    '  "description": "What is literally shown in the image — 1-2 sentences, factual only",',
    '  "technicalContext": "Any code, UI, architecture, tools, or technical elements visible — null if none",',
    '  "suggestedAngle": "The single strongest post angle this image supports, given the brand voice",',
    '  "suggestedTopic": "A 6-10 word topic description for this post"',
    '}',
    "",
    "Return ONLY the JSON object. No preamble, no markdown fences.",
  ].filter(Boolean).join("\n");

  const response = await client.chat.completions.create({
    model:      "gpt-4o",
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role:    "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          { type: "text",      text: userPrompt },
        ],
      },
    ],
  });

  const raw = response.choices[0].message.content?.trim() ?? "{}";

  try {
    return JSON.parse(raw.replace(/^```json|```$/g, "").trim());
  } catch {
    console.warn("[caption] Vision analysis JSON parse failed — using fallback");
    return {
      description:      "Image provided by user",
      technicalContext: null,
      suggestedAngle:   hook || "Technical insight",
      suggestedTopic:   hook || "Developer tip",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// BUILD CAPTION ROTATION
// Assembles a rotation-shaped object from user inputs + vision
// analysis so it can be passed directly to generateCopy().
// This avoids duplicating the quality gate and retry logic.
// ─────────────────────────────────────────────────────────────

function buildCaptionRotation({ analysis, hook, context, angle, rotationType }) {
  const resolvedAngle = angle
    || analysis?.suggestedAngle
    || "Technical insight";

  const contextLines = [
    analysis?.description      ? `Image shows: ${analysis.description}`           : "",
    analysis?.technicalContext ? `Technical elements: ${analysis.technicalContext}` : "",
    context                    ? `Additional context: ${context}`                   : "",
    hook                       ? `Suggested hook: ${hook}`                          : "",
  ].filter(Boolean).join("\n");

  return {
    id:           "custom_caption",
    name:         "Custom Caption",
    type:         rotationType ?? "value",
    category:     "custom",
    angles:       [resolvedAngle],
    hookStyles:   hook ? ["Custom hook"] : ["Hard truth", "Technical insight", "Contrarian take"],
    copyPrompt:   `Write a social media post based on the following context.\n\n${contextLines}\n\nAngle: ${resolvedAngle}\n\nApply all standard brand voice rules. Take one specific, defensible position. End with a discussion question if this is a value post, or a CTA if this is a lab post.`,
    imagePrompt:  "",   // not used — image is user-provided
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export async function generateCaptionFromImage({
  imageBuffer,
  imageMimeType,
  hook,
  context,
  angle,
  rotationType,
  platforms,
}) {
  // ── Step 1: Vision analysis (image path only) ─────────────
  let analysis = null;
  if (imageBuffer) {
    try {
      analysis = await analyseImage({ imageBuffer, imageMimeType, hook, context });
      console.log("[caption] Vision analysis complete:", analysis?.suggestedTopic);
    } catch (err) {
      console.warn("[caption] Vision analysis failed — continuing without it:", err.message);
    }
  }

  // ── Step 2: Build rotation brief ─────────────────────────
  const rotation = buildCaptionRotation({ analysis, hook, context, angle, rotationType });

  // ── Step 3: Fetch generation context ─────────────────────
  const [resourceSnapshot, postHistory, intelligenceBrief] = await Promise.all([
    fetchResourceSnapshot(),
    getPostedTopics(),
    getIntelligenceBrief(),
  ]);

  // ── Step 4: Generate copy per platform ───────────────────
  const wantFacebook  = !platforms || platforms === "both" || platforms === "facebook";
  const wantInstagram = !platforms || platforms === "both" || platforms === "instagram";

  const overrides = {
    angle:     angle || analysis?.suggestedAngle || "Technical insight",
    hookStyle: hook  ? "Custom hook" : undefined,
  };

  const [fbResult, igResult] = await Promise.all([
    wantFacebook  ? generateCopy(rotation, "facebook",  resourceSnapshot, postHistory, intelligenceBrief, overrides) : null,
    wantInstagram ? generateCopy(rotation, "instagram", resourceSnapshot, postHistory, intelligenceBrief, overrides) : null,
  ]);

  const copy = {
    ...(fbResult ? { facebook:  fbResult.copy } : {}),
    ...(igResult ? { instagram: igResult.copy } : {}),
  };

  // ── Step 5: Extract topic ────────────────────────────────
  const sourceCopy = fbResult?.copy ??
