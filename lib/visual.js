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

export async function generateVisual(rotation) {
  const variant = STYLE_VARIANTS[Math.floor(Math.random() * STYLE_VARIANTS.length)];

  const fullPrompt = `${rotation.imagePrompt}

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
