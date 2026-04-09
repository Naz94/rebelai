// ============================================================
// REBEL AI — Caption Generation (lib/caption.js)
//
// Flow:
//   1. Upload image to Vercel Blob → permanent public URL
//   2. GPT-4o Vision analyses the image via URL (no base64)
//   3. Build rotation brief from vision output + user inputs
//   4. generateCopy for each requested platform
//   5. extractTopic for the draft record
//
// Returns: { imageUrl, topic, copy: { facebook?, instagram? }, analysis }
//
// imageUrl is a permanent Blob URL — stored on the draft and
// used directly by Instagram at publish time. The base64 data
// URL approach is dropped: Vision accepts public URLs fine and
// avoids encoding large buffers into the prompt payload.
// ============================================================

import OpenAI    from "openai";
import { put }   from "@vercel/blob";
import { generateCopy, extractTopic } from "./generate.js";
import { fetchResourceSnapshot }      from "./resources.js";
import { getPostedTopics }            from "./kv.js";
import { getIntelligenceBrief }       from "./trends.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function requireOpenAI() {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  return openai;
}

// ─────────────────────────────────────────────────────────────
// BLOB UPLOAD
// Uploads the image buffer immediately and returns a permanent
// public URL. This URL is used for both Vision analysis and
// Instagram publishing — no expiry, no base64 overhead.
// ─────────────────────────────────────────────────────────────

async function uploadToBlob(buffer, mimeType) {
  const ext      = mimeType === "image/png" ? "png" : "jpg";
  const filename = `rebelai/uploads/${Date.now()}.${ext}`;
  const { url }  = await put(filename, buffer, {
    access:      "public",
    contentType: mimeType,
  });
  console.log("[caption] Uploaded to Blob:", url);
  return url;
}

// ─────────────────────────────────────────────────────────────
// VISION ANALYSIS
// Sends the public Blob URL to GPT-4o Vision.
// Returns structured analysis used to seed copy generation.
// ─────────────────────────────────────────────────────────────

async function analyseImage({ imageUrl, hook, context }) {
  const client = requireOpenAI();

  const systemPrompt = `You are a content strategist for Rebel Designs, a South African web development and infrastructure studio.
Your job is to analyse an image and extract context that will help write a sharp, technically credible social media post.
The brand voice is: direct, opinionated, technical, zero fluff. The audience is developers, technical founders, and operators.
Never invent technical claims. Only describe what is actually visible in the image.`;

  const userPrompt = [
    "Analyse this image for use as a social media post visual.",
    hook    ? `User's hook idea: "${hook}"`  : "",
    context ? `User's context: "${context}"` : "",
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
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          { type: "text",      text: userPrompt },
        ],
      },
    ],
  });

  const raw = response.choices[0].message.content?.trim() ?? "{}";

  try {
    return JSON.parse(raw.replace(/^```json|```$/g, "").trim());
  } catch {
    console.warn("[caption] Vision JSON parse failed — using fallback");
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
// ─────────────────────────────────────────────────────────────

function buildCaptionRotation({ analysis, hook, context, angle, rotationType }) {
  const resolvedAngle = angle
    || analysis?.suggestedAngle
    || "Technical insight";

  const contextLines = [
    analysis?.description      ? `Image shows: ${analysis.description}`            : "",
    analysis?.technicalContext ? `Technical elements: ${analysis.technicalContext}` : "",
    context                    ? `Additional context: ${context}`                   : "",
    hook                       ? `Suggested hook: ${hook}`                          : "",
  ].filter(Boolean).join("\n");

  return {
    id:          "custom_caption",
    name:        "Custom Caption",
    type:        rotationType ?? "value",
    category:    "custom",
    angles:      [resolvedAngle],
    hookStyles:  hook ? ["Custom hook"] : ["Hard truth", "Technical insight", "Contrarian take"],
    copyPrompt:  `Write a social media post based on the following context.\n\n${contextLines}\n\nAngle: ${resolvedAngle}\n\nApply all standard brand voice rules. Take one specific, defensible position. End with a discussion question if this is a value post, or a CTA if this is a lab post.`,
    imagePrompt: "",
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export async function generateCaptionFromImage({
  imageBuffer,
  imageMimeType = "image/jpeg",
  hook          = "",
  context       = "",
  angle         = "",
  rotationType  = "value",
  platforms     = "both",
}) {

  // ── Step 1: Upload to Blob ────────────────────────────────
  // Must happen first — the URL is used for Vision and stored
  // on the draft as the permanent Instagram-ready imageUrl.
  let imageUrl = null;
  if (imageBuffer) {
    try {
      imageUrl = await uploadToBlob(imageBuffer, imageMimeType);
    } catch (err) {
      console.warn("[caption] Blob upload failed:", err.message);
      // Non-fatal — imageUrl stays null, publish.js buffer fallback will handle it
    }
  }

  // ── Step 2: Vision analysis ───────────────────────────────
  let analysis = null;
  if (imageUrl) {
    try {
      analysis = await analyseImage({ imageUrl, hook, context });
      console.log("[caption] Vision analysis complete:", analysis?.suggestedTopic);
    } catch (err) {
      console.warn("[caption] Vision analysis failed — continuing without it:", err.message);
    }
  }

  // ── Step 3: Build rotation brief ─────────────────────────
  const rotation = buildCaptionRotation({ analysis, hook, context, angle, rotationType });

  // ── Step 4: Fetch generation context ─────────────────────
  const [resourceSnapshot, postHistory, intelligenceBrief] = await Promise.all([
    fetchResourceSnapshot(),
    getPostedTopics(),
    getIntelligenceBrief(),
  ]);

  // ── Step 5: Generate copy per platform ───────────────────
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

  // ── Step 6: Extract topic ─────────────────────────────────
  const sourceCopy = fbResult?.copy ?? igResult?.copy ?? "";
  const topic      = await extractTopic(sourceCopy);

  return {
    imageUrl,   // permanent Blob URL — null if no image or upload failed
    topic,
    copy,
    analysis,
  };
}
