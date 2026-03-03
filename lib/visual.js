// ============================================================
// REBEL AI — Visual Engine (lib/visual.js)
// ============================================================
import { generateImage, downloadImage } from "./generate.js";

const STYLE_VARIANTS = [
  {
    name:     "extreme-closeup",
    modifier: "Extreme close-up framing. Fill the entire frame. No background visible at all.",
  },
  {
    name:     "negative-space",
    modifier: "Subject occupies 30% of frame centred. Surrounded by vast pure black void. Mathematical precision.",
  },
  {
    name:     "dutch-angle",
    modifier: "Camera tilted 20 degrees. Dutch angle. Creates tension. Premium editorial feel.",
  },
  {
    name:     "overhead-flatlay",
    modifier: "Shot directly from above. Pure black surface. Subject arranged with surgical precision.",
  },
  {
    name:     "motion-blur",
    modifier: "Subject is pin-sharp. Environment has subtle horizontal motion blur. Frozen mid-movement.",
  },
];

// Ask GPT-4o to read the actual post content and describe a concrete visual
async function buildSmartImagePrompt(postContent) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: `You write image prompts for DALL-E 3. 
Your job: read a social media post and describe ONE concrete, specific visual that represents exactly what the post is about.
Rules:
- Describe a real, renderable scene (e.g. "a terminal window showing a React component tree with red error highlights")
- Never use abstract shapes, geometric patterns, or decorative art
- Always include developer context (screens, code, terminals, UI components, browsers)
- Be specific to the post topic — not generic "developer working"
- Max 2 sentences. No colour instructions (handled separately).`,
        },
        {
          role: "user",
          content: `Write a DALL-E image prompt for this post:\n\n${postContent}`,
        },
      ],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "A developer terminal window showing clean, well-structured code on a dark screen.";
}

export async function generateVisual(rotation, postContent = "") {
  const variant = STYLE_VARIANTS[Math.floor(Math.random() * STYLE_VARIANTS.length)];

  // Use post content to build a meaningful visual if available, else fall back to rotation prompt
  const topicDescription = postContent
    ? await buildSmartImagePrompt(postContent)
    : rotation.imagePrompt;

  const fullPrompt = `Developer editorial photograph: ${topicDescription}
${variant.modifier}

MANDATORY COLOUR RULES — non-negotiable, override everything else:
- Background MUST be pure black (#080808). No white backgrounds. No grey. No gradients. Pure black only.
- Primary colour: white (#FFFFFF) for main elements
- Accent: one single red (#FF2D2D) detail only
- Zero other colours permitted
- Square 1:1 format
- Photorealistic, 8K quality`;

  const imageUrl = await generateImage({ ...rotation, imagePrompt: fullPrompt });
  const buffer   = await downloadImage(imageUrl);

  return {
    type:      "static",
    buffer,
    mimeType:  "image/png",
    styleUsed: `static-${variant.name}`,
    imageUrl,
  };
}
