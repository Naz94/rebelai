// ============================================================
// REBEL AI — Visual Engine (lib/visual.js) — no @vercel/blob
// ============================================================

import { generateImage, downloadImage } from "./generate.js";

/**
 * Upload an image buffer directly to the caption API
 */
async function uploadToCaptionAPI(buffer, styleUsed) {
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: "image/png" });
    formData.append("file", blob, `${Date.now()}-${styleUsed}.png`);

    const response = await fetch(`${process.env.API_BASE}/api/agent/content?action=caption`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.META_TOKEN || ""}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Caption API upload failed: ${response.status} — ${text}`);
    }

    const data = await response.json();
    return data.url || ""; // API should return permanent image URL
  } catch (err) {
    console.error("[visual] Upload to caption API failed:", err);
    return null; // fallback to DALL-E URL
  }
}

// ─────────────────────────────────────────────────────────────
// IMAGE MODES
// ─────────────────────────────────────────────────────────────

const IMAGE_MODES = [
  {
    name: "editorial_photo",
    weight: 40,
    buildPrompt: (subject) => `Documentary-style editorial photograph: ${subject} ...`.trim(),
  },
  {
    name: "minimal_graphic",
    weight: 40,
    buildPrompt: (subject) => `Minimalist tech graphic: ${subject} ...`.trim(),
  },
  {
    name: "concept_diagram",
    weight: 20,
    buildPrompt: (subject) => `Clean minimal system diagram: ${subject} ...`.trim(),
  },
];

const FRAMING_VARIANTS = [
  { name: "centered", modifier: "Subject centered in frame." },
  { name: "rule-of-thirds", modifier: "Subject on left third." },
  { name: "closeup", modifier: "Tight framing." },
  { name: "overhead", modifier: "Overhead perspective." },
];

// ─────────────────────────────────────────────────────────────
// SMART PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

async function buildSubjectDescription(postContent, imageMode) {
  const modeHints = {
    editorial_photo: "Describe a realistic, candid scene...",
    minimal_graphic: "Extract 2–4 word phrase...",
    concept_diagram: "Describe system/flow...",
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "Extract visual subjects from social posts. Output 1–2 sentence description suitable for images. For minimal_graphic mode, output 4 words max.",
          },
          {
            role: "user",
            content: `Image mode: ${imageMode}\nHint: ${modeHints[imageMode]}\nPost:\n${postContent.slice(0, 800)}`,
          },
        ],
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "A developer at a laptop";
  } catch (err) {
    console.warn("[visual] Subject extraction failed:", err.message);
    return "A developer at a laptop in a modern workspace";
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
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export async function generateVisual(rotation, postContent = "") {
  const mode = selectImageMode();
  const framing =
    mode.name === "editorial_photo"
      ? FRAMING_VARIANTS[Math.floor(Math.random() * FRAMING_VARIANTS.length)]
      : { name: "default", modifier: "" };

  const subject = postContent
    ? await buildSubjectDescription(postContent, mode.name)
    : rotation.imagePrompt;

  const fullPrompt = [mode.buildPrompt(subject), framing.modifier].filter(Boolean).join("\n\n");
  const styleUsed = `${mode.name}-${framing.name}`;

  const dalleUrl = await generateImage({ ...rotation, imagePrompt: fullPrompt });
  const buffer = await downloadImage(dalleUrl);

  // Upload directly to caption API (no @vercel/blob)
  const imageUrl = (await uploadToCaptionAPI(buffer, styleUsed)) || dalleUrl;

  return {
    type: "static",
    buffer,
    mimeType: "image/png",
    styleUsed,
    imageUrl,
  };
}
