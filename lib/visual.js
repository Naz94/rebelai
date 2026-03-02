// ============================================================
// REBEL AI — Visual Engine (lib/visual.js)
//
// Static DALL-E 3 only — animated GIFs removed for Vercel
// compatibility. pureimage and gifencoder require native
// C++ compilation which fails on Vercel's build system.
// ============================================================

import { generateImage, downloadImage } from "./generate.js";

const STATIC_STYLE_VARIANTS = [
  {
    name:     "extreme-closeup",
    modifier: "Framing: extreme close-up — fill the frame completely. No context, no environment. Just the subject at maximum proximity.",
  },
  {
    name:     "wide-negative-space",
    modifier: "Framing: subject occupies only 30% of the frame, centred. The rest is pure black void. Vast negative space. Lonely and precise.",
  },
  {
    name:     "dutch-angle",
    modifier: "Framing: camera tilted 20 degrees — Dutch angle. Creates tension without being chaotic. Premium editorial photography technique.",
  },
  {
    name:     "overhead-flatlay",
    modifier: "Framing: shot directly from above, flat-lay style. Pure black surface. Subject arranged with mathematical precision.",
  },
  {
    name:     "motion-blur-still",
    modifier: "Framing: the subject is pin-sharp but the environment has subtle horizontal motion blur — frozen mid-movement.",
  },
];

export async function generateVisual(rotation) {
  const variant = STATIC_STYLE_VARIANTS[Math.floor(Math.random() * STATIC_STYLE_VARIANTS.length)];

  const fullPrompt = `${rotation.imagePrompt}

${variant.modifier}

Non-negotiable: pure black background (#080808), white (#FFFFFF) as primary colour, red (#FF2D2D) used once as a single accent only. No gradients. No other colours. Square 1:1 format.`;

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
