// ============================================================
// REBEL AI — Visual Engine (lib/visual.js)
//
// Three image modes rotated per post:
//   1. editorial_photo  — realistic startup/dev photography
//   2. minimal_graphic  — dark minimal quote/concept graphic
//   3. concept_diagram  — clean system/architecture diagram
//
// IMAGE URL PERMANENCE:
// DALL-E 3 returns a temporary Azure CDN URL (~60 min TTL).
// We upload to Vercel Blob immediately after download so the
// draft's imageUrl is a permanent, re-fetchable URL.
// If Blob upload fails we fall back to the DALL-E URL and log
// a warning — the post can still succeed if published quickly.
// ============================================================

import { put }                           from "@vercel/blob";
import { generateImage, downloadImage }  from "./generate.js";

const MAX_RETRIES    = 2;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, label, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[visual] ${label} attempt ${attempt}/${retries + 1} failed: ${err.message}`);
      if (attempt <= retries) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────
// IMAGE MODES
// ─────────────────────────────────────────────────────────────

const IMAGE_MODES = [
  {
    name: "editorial_photo",
    weight: 40,
    buildPrompt: (subject) => `
Documentary-style editorial photograph: ${subject}

Environment: realistic modern workspace — laptops, whiteboards, coffee mug, sticky notes, minor desk clutter.
Lighting: natural window light, no studio flash.
Style: candid editorial photography, photojournalism aesthetic. Small imperfections allowed: slight motion blur on periphery, uneven natural lighting, real desk clutter, imperfect composition.
Camera: Sony A7IV, 35mm lens, f/2.0, shallow depth of field, subtle film grain.
Colour: natural tones, no colour grading.

Avoid: holograms, glowing UI, cyberpunk lighting, futuristic interfaces, neon glow, sci-fi aesthetics, overly perfect composition.
Format: square 1:1.
`.trim(),
  },
  {
    name: "minimal_graphic",
    weight: 40,
    buildPrompt: (subject) => `
Minimalist tech graphic on a pure black (#080808) background.

The concept to visualise: ${subject}

CRITICAL TEXT RULE: If any text is shown, it must be 4 words maximum. Short. Bold. Perfectly legible.
Do NOT attempt to render full sentences or long phrases — DALL-E will distort them into gibberish.
If the concept cannot be expressed in 4 words, show it as a diagram or icon instead — no text at all.

Design style: modern SaaS, high contrast, generous whitespace.
Typography (if used): bold white sans-serif, centered, no decorative effects.
Feel: designed by a human graphic designer, not AI-generated.

Avoid: gradients, glow, decorative geometry, lens flares, holograms, long sentences rendered as text.
Format: square 1:1.
`.trim(),
  },
  {
    name: "concept_diagram",
    weight: 20,
    buildPrompt: (subject) => `
Clean minimal system architecture diagram on a dark background: ${subject}

Style: engineering whitepaper diagram — precise, functional, no decoration.
Elements: white lines and labeled nodes on dark background, directional arrows showing data flow.
Node labels must be 1-2 words only — short enough to render legibly.
Aesthetic: between an Apple WWDC architecture slide and a technical specification document.
Layout: clear hierarchy, generous spacing, clinical precision.

Avoid: 3D effects, shadows, glow, decorative icons, stock-art clipart, gradients, colour fills, long text strings.
Format: square 1:1.
`.trim(),
  },
];

// ─────────────────────────────────────────────────────────────
// FRAMING VARIANTS
// ─────────────────────────────────────────────────────────────

const FRAMING_VARIANTS = [
  { name: "centered",       modifier: "Subject centered in frame. Balanced composition." },
  { name: "rule-of-thirds", modifier: "Subject positioned on left third. Breathing room to the right." },
  { name: "closeup",        modifier: "Tight framing. Subject fills 70% of frame." },
  { name: "overhead",       modifier: "Shot directly from above. Clean overhead perspective." },
];

// ─────────────────────────────────────────────────────────────
// SMART PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

const FALLBACK_SUBJECTS = {
  editorial_photo: "A developer focused at a laptop in a clean modern workspace, natural window light",
  minimal_graphic: "Build for scale",
  concept_diagram: "Client server data flow with authentication layer",
};

async function buildSubjectDescription(postContent, imageMode) {
  const modeHints = {
    editorial_photo: "Describe a realistic, candid scene — a person, a workspace, a device in use. Something a photographer could actually capture.",
    minimal_graphic: "Extract the single sharpest 2–4 word phrase from this post. Something that works as large bold text on a dark background. Must be 4 words or fewer — DALL-E cannot render longer text without errors.",
    concept_diagram: "Describe the system, flow, or relationship that this post is about — as a simple diagram with labeled components (1-2 word labels only) and directional connections.",
  };

  try {
    const response = await withRetry(async () => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model:      "gpt-4o",
          max_tokens: 80,
          messages: [
            {
              role:    "system",
              content: `You extract visual subjects from social media posts. Output a 1-2 sentence description of what to show in an image. Never describe colours or style. Describe only a physical scene, object, diagram structure, or short phrase that can actually be visualised — nothing abstract or metaphorical. For minimal_graphic mode, output a phrase of 4 words maximum.`,
            },
            {
              role:    "user",
              content: `Image mode: ${imageMode}\nHint: ${modeHints[imageMode]}\n\nPost:\n${postContent.slice(0, 800)}`,
            },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI subject extraction failed (${res.status}): ${err}`);
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Empty response from subject extraction");
      return text;
    }, "subject-extraction");

    return response;
  } catch (err) {
    console.warn("[visual] Subject extraction failed — using fallback:", err.message);
    return FALLBACK_SUBJECTS[imageMode] ?? "A developer working at a laptop in a modern workspace";
  }
}

// ─────────────────────────────────────────────────────────────
// MODE SELECTOR
// ─────────────────────────────────────────────────────────────

function selectImageMode() {
  const r = Math.random() * 100;
  let cumulative = 0;
  for (const mode of IMAGE_MODES) {
    cumulative += mode.weight;
    if (r < cumulative) return mode;
  }
  return IMAGE_MODES[0];
}

// ─────────────────────────────────────────────────────────────
// BLOB UPLOAD
// ─────────────────────────────────────────────────────────────

async function uploadToBlob(buffer, runId, styleUsed) {
  try {
    const filename = `rebelai/visuals/${runId ?? Date.now()}-${styleUsed}.png`;
    const { url } = await put(filename, buffer, {
      access:      "public",
      contentType: "image/png",
    });
    console.log("[visual] Uploaded to Vercel Blob:", url);
    return url;
  } catch (err) {
    console.warn("[visual] Blob upload failed — falling back to DALL-E URL:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export async function generateVisual(rotation, postContent = "", runId = null) {
  const mode    = selectImageMode();
  const framing = mode.name === "editorial_photo"
    ? FRAMING_VARIANTS[Math.floor(Math.random() * FRAMING_VARIANTS.length)]
    : { name: "default", modifier: "" };

  const subject = await buildSubjectDescription(postContent || rotation.copyPrompt || "", mode.name);

  const fullPrompt = [
    mode.buildPrompt(subject),
    framing.modifier,
  ].filter(Boolean).join("\n\n");

  const styleUsed = `${mode.name}-${framing.name}`;

  let dalleUrl, buffer;

  try {
    dalleUrl = await withRetry(
      () => generateImage({ ...rotation, imagePrompt: fullPrompt }),
      "DALL-E generation"
    );
  } catch (err) {
    console.error("[visual] DALL-E generation failed after retries:", err.message);
    throw new Error(`Image generation failed: ${err.message}`);
  }

  try {
    buffer = await withRetry(
      () => downloadImage(dalleUrl),
      "image download"
    );
  } catch (err) {
    console.error("[visual] Image download failed after retries:", err.message);
    throw new Error(`Image download failed: ${err.message}`);
  }

  // Upload to Vercel Blob — permanent URL for Instagram and draft longevity
  const blobUrl  = await uploadToBlob(buffer, runId, styleUsed);
  const imageUrl = blobUrl ?? dalleUrl;

  if (!blobUrl) {
    console.warn("[visual] WARNING: Using temporary DALL-E URL — publish before it expires (~60 min)");
  }

  return {
    type: "static",
    buffer,
    mimeType:  "image/png",
    styleUsed,
    imageUrl,
  };
}
