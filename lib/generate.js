// ============================================================
// REBEL DESIGNS — Content Generation
// Claude (Anthropic) generates copy.
// DALL-E 3 (OpenAI) generates images.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { BRAND_SYSTEM_PROMPT, PLATFORM_INSTRUCTIONS } from "./brand.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * PRO-TIP #3 FIX — Anti-Hallucination Resource Feed
 *
 * Instead of Claude guessing what tools/resources exist on the site,
 * we inject a verified snapshot of current lab tools and resources.
 * This ensures URLs, tool names, and descriptions are always accurate.
 *
 * The snapshot comes from lib/resources.js — either fetched live from
 * rebeldesigns.co.za/api/resources-summary or from a hardcoded fallback.
 */
export async function generateCopy(rotation, platform, resourceSnapshot) {
  // Build the resource context block to inject into the prompt
  const resourceContext = `
VERIFIED SITE RESOURCES (use these exact URLs and names — do not invent others):
${resourceSnapshot.labTools.map(t => `- ${t.name}: ${t.description} → ${t.url}`).join("\n")}

RESOURCES PAGE: rebeldesigns.co.za/resources
Available resource types: ${resourceSnapshot.resourceTypes.join(", ")}
`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: BRAND_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${PLATFORM_INSTRUCTIONS[platform]}\n\n${resourceContext}\n\nContent brief:\n${rotation.copyPrompt}`,
      },
    ],
  });

  return message.content[0].text.trim();
}

/**
 * Generate a neon-glitch image using DALL-E 3.
 * Returns the image URL (valid for 1 hour — download immediately).
 */
export async function generateImage(rotation) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: rotation.imagePrompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    style: "vivid",
  });

  return response.data[0].url;
}

/**
 * Download an image URL and return it as a Buffer.
 * Required because social APIs need the raw binary, not a URL.
 */
export async function downloadImage(url) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
