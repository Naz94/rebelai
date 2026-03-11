// ============================================================
// REBEL AI — Visual Engine (lib/visual.js)
//
// Three image modes rotated per post:
//   1. editorial_photo  — realistic startup/dev photography
//   2. minimal_graphic  — dark minimal quote/concept graphic
//   3. concept_diagram  — clean system/architecture diagram
//
// Mode is chosen per-post. Smart prompt builder reads the actual
// post content and fills in the subject for each mode.
//
// Why three modes: DALL-E 3 with a single "editorial photograph"
// mandate + black/white colour rules always drifts toward
// dramatic tech art. Rotating modes prevents that pattern and
// makes the feed look human-curated.
// ============================================================

import { generateImage, downloadImage } from "./generate.js";

// ─────────────────────────────────────────────────────────────
// IMAGE MODES
// Each mode has its own prompt wrapper designed to avoid the
// "AI-generated" look: no holograms, no neon, no cyberpunk.
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
Minimalist tech graphic on a pure black (#080808) background: ${subject}

Design style: modern SaaS design, high contrast, generous whitespace.
Typography: bold white sans-serif text, centered, no decorative effects.
Layout: simple, intentional — text and one supporting diagram element only.
Feel: designed by a human graphic designer, not AI-generated.

Avoid: gradients, glow effects, decorative geometry, stock-art elements, lens flares, holograms.
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
Aesthetic: between an Apple WWDC architecture slide and a technical specification document.
Layout: clear hierarchy, generous spacing, clinical precision.

Avoid: 3D effects, shadows, glow, decorative icons, stock-art clipart, gradients, colour fills.
Format: square 1:1.
`.trim(),
  },
];

// ─────────────────────────────────────────────────────────────
// FRAMING VARIANTS
// Applied on top of the mode prompt to vary composition.
// Kept neutral — no "dutch angle" or "motion blur" which push
// toward the AI-art aesthetic.
// ─────────────────────────────────────────────────────────────

const FRAMING_VARIANTS = [
  { name: "centered",      modifier: "Subject centered in frame. Balanced composition." },
  { name: "rule-of-thirds", modifier: "Subject positioned on left third. Breathing room to the right." },
  { name: "closeup",       modifier: "Tight framing. Subject fills 70% of frame." },
  { name: "overhead",      modifier: "Shot directly from above. Clean overhead perspective." },
];

// ─────────────────────────────────────────────────────────────
// SMART PROMPT BUILDER
// Reads the actual post and extracts a concrete visual subject.
// Instructs GPT-4o to produce a subject description, not a full
// prompt — the mode wrapper handles the rest.
// ─────────────────────────────────────────────────────────────

async function buildSubjectDescription(postContent, imageMode) {
  const modeHints = {
    editorial_photo:  "Describe a realistic, candid scene — a person, a workspace, a device in use. Something a photographer could actually capture.",
    minimal_graphic:  "Extract the single sharpest idea from this post as a short statement (max 12 words) — the kind of thing that works as bold text on a dark background.",
    concept_diagram:  "Describe the system, flow, or relationship that this post is about — as a simple diagram with labeled components and directional connections.",
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
          content: `You extract visual subjects from social media posts. Output a 1-2 sentence description of what to show in an image. Never describe colours or style. Describe only a physical scene, object, diagram structure, or short statement that can actually be visualised — nothing abstract or metaphorical.`,
        },
        {
          role:    "user",
          content: `Image mode: ${imageMode}\nHint: ${modeHints[imageMode]}\n\nPost:\n${postContent.slice(0, 800)}`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim()
    || "A developer at a laptop in a realistic modern workspace";
}

// ─────────────────────────────────────────────────────────────
// MODE SELECTOR — weighted random, biased toward photo + graphic
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
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export async function generateVisual(rotation, postContent = "") {
  const mode    = selectImageMode();
  const framing = mode.name === "editorial_photo"
    ? FRAMING_VARIANTS[Math.floor(Math.random() * FRAMING_VARIANTS.length)]
    : { name: "default", modifier: "" };

  let subject;
  try {
    subject = postContent
      ? await buildSubjectDescription(postContent, mode.name)
      : rotation.imagePrompt;
  } catch (err) {
    console.warn("[visual] Subject extraction failed, using fallback:", err.message);
    subject = "A developer working at a laptop in a modern workspace";
  }

  const fullPrompt = [
    mode.buildPrompt(subject),
    framing.modifier,
  ].filter(Boolean).join("\n\n");

  const imageUrl = await generateImage({ ...rotation, imagePrompt: fullPrompt });
  const buffer   = await downloadImage(imageUrl);

  return {
    type:      "static",
    buffer,
    mimeType:  "image/png",
    styleUsed: `${mode.name}-${framing.name}`,
    imageUrl,
  };
}
