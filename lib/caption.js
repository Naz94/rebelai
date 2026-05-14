// ============================================================
// REBEL AI — Caption Generation (lib/caption.js)
//
// Flow:
//   1. Upload image to Vercel Blob → permanent public URL
//   2. GPT-4o Vision analyses the image via URL (no base64)
//   3. Build rotation brief from vision output + user inputs
//   4. generateCopy for Facebook (single source of truth)
//   5. adaptForInstagram from Facebook copy (same message, compressed)
//   6. extractTopic for the draft record
//
// Returns: { imageUrl, topic, copy: { facebook?, instagram? }, analysis }
//
// imageUrl is a permanent Blob URL — stored on the draft and
// used directly by Instagram at publish time.
// ============================================================

import OpenAI    from "openai";
import { put }   from "@vercel/blob";
import { generateCopy, extractTopic, adaptForInstagram } from "./generate.js";
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
// Analyses the image for context to seed SME-audience copy.
// ─────────────────────────────────────────────────────────────

async function analyseImage({ imageUrl, hook, context }) {
  const client = requireOpenAI();

  const systemPrompt = `You are a content strategist for Rebel Designs, a South African web studio that builds websites, online stores, and AI tools for small and medium businesses.
Your job is to analyse an image and extract context that will help write a social media post aimed at South African business owners.
The brand voice is: direct, warm, plain language. The audience is business owners — not developers or technical people.
Never invent claims. Only describe what is actually visible in the image.`;

  const userPrompt = [
    "Analyse this image for use as a social media post visual.",
    hook    ? `User's hook idea: "${hook}"`       : "",
    context ? `User's context: "${context}"`      : "",
  ].filter(Boolean).join("\n");

  const response = await client.chat.completions.create({
    model:      "gpt-4o",
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role:    "user",
        content: [
          { type: "text",      text: userPrompt },
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
        ],
      },
    ],
  });

  const raw = response.choices[0].message.content?.trim() ?? "";

  // Parse structured JSON if model returned it, otherwise build a minimal object
  try {
    return JSON.parse(raw);
  } catch {
    return {
      subject:        raw.slice(0, 120),
      suggestedAngle: hook || "Business owner insight",
      suggestedTopic: hook || "Business",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// ROTATION BUILDER
// Constructs a rotation-like brief from vision output + user inputs
// so generateCopy can treat it like any other rotation.
// ─────────────────────────────────────────────────────────────

function buildCaptionRotation({ analysis, hook, context, angle, rotationType }) {
  const resolvedAngle = angle
    || analysis?.suggestedAngle
    || hook
    || "Business owner insight";

  const contextLines = [
    analysis?.subject         ? `Image shows: ${analysis.subject}`                : "",
    analysis?.businessContext ? `Business context: ${analysis.businessContext}`    : "",
    context                   ? `Additional context: ${context}`                   : "",
    hook                      ? `Suggested hook: ${hook}`                          : "",
  ].filter(Boolean).join("\n");

  const closingRule = rotationType === "lab"
    ? "End with a soft CTA inviting them to reach out or see more at rebeldesigns.co.za. Do NOT end with a question."
    : "End with a genuine question the reader can answer from their own experience as a business owner.";

  return {
    id:          "custom_caption",
    name:        "Custom Caption",
    type:        rotationType ?? "value",
    category:    "custom",
    angles:      [resolvedAngle],
    hookStyles:  hook ? ["Custom hook"] : ["Direct truth", "Relatable situation", "Surprising fact"],
    copyPrompt:  `Write a social media post for South African business owners based on the following context.\n\n${contextLines}\n\nAngle: ${resolvedAngle}\n\nAudience: Business owners — not technical people. Plain language only. No jargon.\nApply all standard brand voice rules.\n${closingRule}`,
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
  let imageUrl = null;
  if (imageBuffer) {
    try {
      imageUrl = await uploadToBlob(imageBuffer, imageMimeType);
    } catch (err) {
      console.warn("[caption] Blob upload failed:", err.message);
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

  // ── Step 5: Generate copy ─────────────────────────────────
  // Facebook copy is generated once — single source of truth.
  // If Instagram is also requested, it is adapted from the Facebook
  // copy via adaptForInstagram (gpt-4o-mini) — same message,
  // compressed to ≤100 words, 25 hashtags appended.
  // If only Instagram is requested (platforms="instagram"), we still
  // generate Facebook first then adapt — avoids maintaining a separate
  // Instagram generation path.

  const wantFacebook  = !platforms || platforms === "both" || platforms === "facebook";
  const wantInstagram = !platforms || platforms === "both" || platforms === "instagram";

  const overrides = {
    angle:     angle || analysis?.suggestedAngle || "Business owner insight",
    hookStyle: hook  ? "Custom hook" : undefined,
  };

  const fbResult      = await generateCopy(rotation, "facebook", resourceSnapshot, postHistory, intelligenceBrief, overrides);
  const facebookCopy  = fbResult.copy;
  const instagramCopy = wantInstagram ? await adaptForInstagram(facebookCopy) : null;

  const copy = {
    ...(wantFacebook  ? { facebook:  facebookCopy  } : {}),
    ...(wantInstagram ? { instagram: instagramCopy } : {}),
  };

  // ── Step 6: Extract topic ─────────────────────────────────
  const topic = await extractTopic(facebookCopy);

  return {
    imageUrl,
    topic,
    copy,
    analysis,
  };
}
