// ============================================================
// REBEL AI — Content Generation (lib/generate.js)
// ============================================================

import OpenAI from "openai";
import { BRAND_SYSTEM_PROMPT, PLATFORM_INSTRUCTIONS } from "./brand.js";
import { validateAgentInput }                          from "./popia.js";
import { pickAngle, pickHookStyle }                    from "./rotations.js";
import { getHookWeights }                              from "./performance.js";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function requireOpenAI() {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  return openai;
}

export async function generateCopy(rotation, platform, resourceSnapshot, postHistory = [], intelligenceBrief = null, overrides = {}) {

  const inputScan = validateAgentInput(rotation, resourceSnapshot);
  if (!inputScan.passed) {
    console.warn(`[generate] POPIA WARNING: Input scan flagged for ${platform} — continuing but logging`);
  }

  const hookWeights = overrides.hookStyle ? {} : await getHookWeights().catch(() => ({}));
  const angle       = overrides.angle     ?? pickAngle(rotation);
  const hookStyle   = overrides.hookStyle ?? pickHookStyle(rotation, hookWeights);

  const userPrompt = buildUserPrompt({
    rotation,
    platform,
    resourceSnapshot,
    postHistory,
    intelligenceBrief,
    angle,
    hookStyle,
  });

  const rotationType = rotation.type ?? "value";

  const client   = requireOpenAI();
  let copy        = "";
  let attempts    = 0;
  let lastFailure = "";

  do {
    attempts++;

    const retryAnchor = attempts > 1
      ? `\n\nCRITICAL — RETRY ${attempts}: Previous attempt was rejected. Reason: ${lastFailure}. Do NOT use that phrase or pattern. Stay on the same topic: "${angle}". Rewrite completely — different opening sentence, different structure, same subject.`
      : "";

    const response = await client.chat.completions.create({
      model:      "gpt-4o",
      max_tokens: 350,
      messages: [
        { role: "system", content: BRAND_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt + retryAnchor },
      ],
    });

    const raw = response.choices[0].message.content?.trim() ?? "";
    copy      = normaliseHashtagOutput(raw);

    const gateResult = checkQualityGate(copy, platform, rotationType);
    if (gateResult.passed && passesHallucinationCheck(copy)) break;

    lastFailure = gateResult.reason ?? "unknown quality issue";
    console.warn(`[generate] Attempt ${attempts} failed: ${lastFailure}`);
  } while (attempts < 3);

  if (attempts === 3) {
    console.warn(`[generate] WARNING: Max attempts reached — last failure: ${lastFailure} — using last output`);
  }

  return { copy, hookStyle };
}

// ─────────────────────────────────────────────────────────────
// INSTAGRAM ADAPTER
// ─────────────────────────────────────────────────────────────

export async function adaptForInstagram(facebookCopy) {
  const client = requireOpenAI();

  const prompt = `You are adapting a Facebook post for Instagram. The message must be IDENTICAL — same opening line, same story, same CTA or closing question. Do NOT change the angle or invent new content.

Rules:
- Keep the opening sentence word-for-word
- Compress the body to ≤100 words (excluding hashtags)
- Remove sentences that repeat the same point — keep only the sharpest version
- Keep the closing question or CTA from the original exactly as written
- Keep all proper nouns and product names exactly as written in the original (e.g. "Rebel Designs built the X" not "Our X")
- End with exactly 25 relevant South African business hashtags on a new line, space-separated
- No duplicate hashtags
- No run-together hashtags (no #tag#tag)
- No em-dash (—) or en-dash (–)
- Return ONLY the Instagram caption — no preamble, no labels, no quotes

Facebook post to adapt:
${facebookCopy}`;

  const response = await client.chat.completions.create({
    model:      "gpt-4o-mini",
    max_tokens: 400,
    messages: [
      { role: "system", content: BRAND_SYSTEM_PROMPT },
      { role: "user",   content: prompt },
    ],
  });

  const raw = response.choices[0].message.content?.trim() ?? "";
  return normaliseHashtagOutput(raw);
}

// ─────────────────────────────────────────────────────────────
// HOOK STYLE INSTRUCTIONS
// Maps hookStyle name to a concrete SLOT 1 instruction.
// This is the fix: hookStyle is now actually used in the template.
// ─────────────────────────────────────────────────────────────

function getSlot1Instruction(hookStyle, angle) {
  const instructions = {
    "Direct truth": `One sentence. A blunt, specific true statement about South African businesses related to: ${angle}. Present tense. No hedge words. No question. No "Most South African X..." opener — find a different angle in.
Example: "A website built three years ago was fine for three years ago."
Example: "The first business to reply on WhatsApp usually gets the sale."`,

    "Relatable situation": `One sentence. Describe a specific moment or situation a South African business owner would immediately recognise, related to: ${angle}. No "Most businesses..." opener. Put the reader in the scene.
Example: "A customer messages at 9pm asking about prices. Nobody replies until morning."
Example: "You open your website on your phone and half the menu is cut off."`,

    "Surprising fact": `One sentence. A specific, counterintuitive or underappreciated truth about South African businesses related to: ${angle}. Not "Most..." — state something they didn't know or haven't thought about this way.
Example: "The developer who built your website probably still controls your domain."
Example: "Four seconds is all it takes for most mobile visitors to leave a slow site."`,

    "Contrast: what most people do vs what works": `One sentence. Name the common behaviour and what it actually costs, related to: ${angle}. Avoid "Most South African businesses..." as an opener — build the contrast differently.
Example: "Posting when you remember feels fine until you check how long ago the last one was."
Example: "Getting a cheap website saves money once. Losing customers costs money every day."`,
  };

  return instructions[hookStyle] ?? instructions["Direct truth"];
}

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────

function buildUserPrompt({ rotation, platform, resourceSnapshot, postHistory, intelligenceBrief, angle, hookStyle }) {

  const toolList = (resourceSnapshot.tools ?? [])
    .map(t => formatResource(t))
    .join("\n\n");

  const projectList = (resourceSnapshot.projects ?? [])
    .map(p => formatResource(p))
    .join("\n\n");

  const brandFacts = resourceSnapshot.brandFacts ?? {};

  const resourceContext = `
VERIFIED SITE CONTENT — use exact names and URLs, never invent or paraphrase:

WHAT REBEL DESIGNS DOES:
${brandFacts.positioning ?? "Websites, online stores, and AI tools for South African businesses."}

Services offered:
${(brandFacts.services ?? []).map(s => `- ${s}`).join("\n")}

Ownership policy: ${brandFacts.ownershipPolicy ?? ""}
South African context: ${brandFacts.southAfricanContext ?? ""}

TOOLS:
${toolList || "None currently"}

PROJECTS & WORK:
${projectList || "None currently"}

RESOURCES:
${(resourceSnapshot.resources ?? []).map(r => {
  const terms = r.antiHallucinationTerms?.length ? `\n  Exact names/URLs: ${r.antiHallucinationTerms.join(", ")}` : "";
  const hooks  = r.contentHooks?.length ? `\n  Hooks:\n${r.contentHooks.map(h => `    - "${h}"`).join("\n")}` : "";
  return `- ${r.name}: ${r.description} -> ${r.url}${terms}${hooks}`;
}).join("\n") || "None currently"}

MAIN SITE: rebeldesigns.co.za
RESOURCES: rebeldesigns.co.za/resources`.trim();

  const historyContext = postHistory.length > 0
    ? `PREVIOUSLY POSTED — DO NOT REPEAT these topics, angles, or opening lines:
${postHistory.slice(-20).map((p, i) => `${i + 1}. [${p.rotation}] ${p.topic}`).join("\n")}

Choose a completely fresh angle and different opening.`.trim()
    : "No previous posts yet — this is the first post.";

  const freshnessDirective = `FRESHNESS RULES — non-negotiable:
- The opening line must be unlike anything in the post history above
- Do not use the same hook structure twice in a row
- Pick ONE specific, concrete situation or insight — not a broad overview
- The post must feel like it was written today about something real`.trim();

  const trendContext = intelligenceBrief
    ? `CURRENT TREND INTELLIGENCE:\n${intelligenceBrief}`
    : "";

  const isLab       = rotation.type === "lab";
  const isInstagram = platform === "instagram";

  // ── Get the hookStyle-specific SLOT 1 instruction ────────
  const slot1Instruction = getSlot1Instruction(hookStyle, angle);

  const facebookTemplate = isLab ? `
Write a Facebook post using EXACTLY this structure. Fill each slot. Do not add extra sentences between slots.

[SLOT 1 — Opening: ${slot1Instruction}]

[SLOT 2 — The specific problem: One or two sentences. What actually happens as a result. Concrete and direct. Example: "A customer messages at 9pm. By morning they've already gone with someone else."]

[SLOT 3 — What Rebel Designs built: One sentence naming the specific project and what it does in plain language. Use exact names from the verified content.]

[SLOT 4 — What changed: One sentence. The business outcome after the build. What the owner no longer has to do.]

[SLOT 5 — CTA: "This is the kind of thing we build. See more at rebeldesigns.co.za"]

[HASHTAGS: 3-5 relevant hashtags]

RULES:
- No em-dash (—) or en-dash (–). Full stops only.
- No clichés: no "seamless", "crucial", "changes the game", "makes all the difference", "you're not alone", "lifting a finger"
- No rhetorical questions anywhere
- Plain language. Short sentences.
` : `
Write a Facebook post using EXACTLY this structure. Fill each slot. Do not add sentences between slots.

[SLOT 1 — Opening (hook style: "${hookStyle}"): ${slot1Instruction}]

[SLOT 2 — Why it matters: One or two sentences. The direct consequence of the problem. What happens to the business. Example: "If your website takes 4 seconds to load, most visitors leave before seeing anything you offer."]

[SLOT 3 — The specific detail: One or two sentences. A concrete aspect of the problem most business owners don't think about. Draw from: ${rotation.copyPrompt.slice(0, 200)}]

[SLOT 4 — What good looks like: One sentence. What the business looks like when this is solved. No fluff.]

[SLOT 5 — Closing question: One genuine question the reader can answer from their own experience. Not rhetorical.]

[HASHTAGS: 3-5 relevant hashtags]

RULES:
- No em-dash (—) or en-dash (–). Full stops only.
- No clichés: no "seamless", "crucial", "changes the game", "makes all the difference", "you're not alone", "lifting a finger", "think about it", "imagine if"
- No rhetorical questions — only the single closing question in Slot 5
- Plain language. Short sentences. Max 200 words total.
`;

  const instagramTemplate = isLab ? `
Write an Instagram caption using EXACTLY this structure.

[SLOT 1 — Opening (hook style: "${hookStyle}"): ${slot1Instruction}]

[SLOT 2 — The problem in one sentence: What happens as a result. Concrete.]

[SLOT 3 — The solution: One sentence. What Rebel Designs built. Plain language. Use exact project name.]

[SLOT 4 — CTA: "This is the kind of thing we build. See more at rebeldesigns.co.za"]

[blank line]
[HASHTAGS: exactly 25 hashtags, space-separated, no label]

RULES: No em-dash. No en-dash. No clichés. No rhetorical questions. Max 90 words before hashtags.
` : `
Write an Instagram caption using EXACTLY this structure.

[SLOT 1 — Opening (hook style: "${hookStyle}"): ${slot1Instruction}]

[SLOT 2 — Consequence: One sentence. What happens to the business because of this. Direct. Example: "A site that looks broken on mobile loses the customer before they see your prices."]

[SLOT 3 — The specific reality: One sentence. A concrete detail most business owners miss. Draw from: ${rotation.copyPrompt.slice(0, 150)}]

[SLOT 4 — Closing question: One genuine question they can answer from experience.]

[blank line]
[HASHTAGS: exactly 25 hashtags, space-separated, no label, no duplicates]

RULES: No em-dash. No en-dash. No clichés. No rhetorical questions except Slot 4. Max 90 words before hashtags.
`;

  const template = isInstagram ? instagramTemplate : facebookTemplate;

  return [
    resourceContext,
    historyContext,
    trendContext,
    freshnessDirective,
    template,
  ].filter(Boolean).join("\n\n");
}

// ─────────────────────────────────────────────────────────────
// RESOURCE FORMATTER
// ─────────────────────────────────────────────────────────────

function formatResource(r) {
  const lines = [`- ${r.name} [${r.status ?? ""}] (${r.url}): ${r.description}`];

  if (r.businessProblem) {
    lines.push(`  Business problem it solves: ${r.businessProblem}`);
  }
  if (r.businessOutcome) {
    lines.push(`  Business outcome: ${r.businessOutcome}`);
  }
  if (r.storyMoments?.length) {
    lines.push(`  Story moments:\n${r.storyMoments.map(s => `    - ${s}`).join("\n")}`);
  }
  if (r.antiHallucinationTerms?.length) {
    lines.push(`  Exact names/URLs (use verbatim): ${r.antiHallucinationTerms.join(", ")}`);
  }
  if (r.contentHooks?.length) {
    lines.push(`  Content hooks:\n${r.contentHooks.map(h => `    - "${h}"`).join("\n")}`);
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// QUALITY GATE
// ─────────────────────────────────────────────────────────────

const BANNED_OPENERS = [
  /^are you tired of/i,
  /^running a business (is|can be)/i,
  /^as a business owner/i,
  /^every business owner knows/i,
  /^did you know that/i,
  /^transform your/i,
  /^grow your business/i,
  /^take your business to/i,
  /^in today['']s /i,
  /^it['']s no secret/i,
  /^unlock your/i,
  /^unlock the/i,
  /^dive deep/i,
  /^your .{0,40} is more than just/i,
  /^we['']ve all been there/i,
  /^imagine (that|your|a )/i,
  /^think about (it|the|your|a )/i,
  /^does your .{0,40} (leave|send|make|work|look)/i,
  /^picture this/i,
  /^here['']s the thing/i,
  /^scheduling .{0,30} feels like/i,
  /^managing .{0,30} (can|feels|is)/i,
  /^here is your post/i,
  /^here['']s your post/i,
  /^here['']s why/i,
  /^the (rise|power|key|secret|truth|reality|problem|answer) of/i,
  // ── NEW: ban the repetitive "Most South African X..." opener ──
  /^most south african (businesses|customers|business owners|small businesses)/i,
  /^most (small |local )?businesses in south africa/i,
];

const BANNED_PHRASES = [
  "it's no secret",
  "unlock your potential",
  "unlock the",
  "revolutionize",
  "revolutionise",
  "transform your business",
  "grow your business",
  "take your business to the next level",
  "dive deep",
  "in today's digital landscape",
  "in today's digital age",
  "in today's world",
  "in today's market",
  "game-changer",
  "game changer",
  "changes the game",
  "change the game",
  "leverage",
  "cutting-edge",
  "cutting edge",
  "state-of-the-art",
  "best-in-class",
  "industry-leading",
  "world-class",
  "\u2014",
  "\u2013",
  "the saveable insight:",
  "saveable insight:",
  "the architectural lesson",
  "architectural insight",
  "echoes through",
  "it goes without saying",
  "discover how",
  "discover more",
  "discover what",
  "explore how rebel designs",
  "rebel designs'",
  "rebel designs is proof",
  "not merely",
  "mere automation",
  "true intelligence",
  "here's why:",
  "here's the thing:",
  "consider this:",
  "the real question is",
  "the real culprit",
  "the key lies in",
  "the promise of",
  "this isn't just a theoretical",
  "effortlessly",
  "seamlessly",
  "with ease",
  "ensures smooth operations",
  "fundamentally reshaping",
  "redefining scalability",
  "enables you to",
  "empowers you to",
  "allows you to focus on what matters",
  "so you can focus on what matters",
  "without breaking a sweat",
  "is more than just",
  "we've all been there",
  "surprising, right",
  "without losing your voice",
  "juggling the timing",
  "really protected",
  "it's worth checking",
  "automated solutions",
  "valuable time",
  "missing out on customers",
  "keeping their brand",
  "hits hard when you realize",
  "can't afford",
  "is like having a",
  "it's like having a",
  "like having a",
  "protective measures",
  "are crucial",
  "is crucial",
  "no tech skills needed",
  "didn't even know were there",
  "don't let one slip",
  "slip through your",
  "headache no business",
  "a potential financial hit",
  "stepping into the unknown",
  "make or break your experience",
  "website journey",
  "doesn't have to be a mystery",
  "confidence comes from",
  "without the stress",
  "watch for to stay on track",
  "freeing your time for things that matter",
  "change everything",
  "pile up fast",
  "focus on the bigger picture",
  "not the other way around",
  "it's time it started",
  "treat whatsapp as",
  "second sales channel",
  "you're not alone",
  "make all the difference",
  "makes all the difference",
  "keep the conversation flowing",
  "stop losing out",
  "what truly needs your attention",
  "all night long",
  "without you lifting a finger",
  "lifting a finger",
  "it's not just about being",
  "sounds like a dream",
  "but what if you",
  "but what if the",
  "what if the inquiries",
  "imagine handling",
  "imagine automating",
  "imagine if your",
  "you might not realise",
  "you might not realize",
  "many business owners don't realise",
  "many business owners don't realize",
  "many south african businesses",
  "without you even",
  "long after the doors close",
  "hardly working",
  "working hard or hardly",
  "showing off what you offer",
  "think about it",
  // ── NEW: ban the tired "Most South African..." opener as a phrase too ──
  "most south african businesses",
  "most south african customers",
  "most south african business owners",
  "most small businesses in south africa",
];

function endsWithQuestion(copy) {
  const lines = copy.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const lastLine = lines[lines.length - 1] ?? "";
  return lastLine.endsWith("?");
}

function checkQualityGate(copy, platform = "facebook", rotationType = "value") {
  const fail = (reason) => ({ passed: false, reason });

  if (!copy || copy.length < 80) return fail("copy too short");

  const firstLine = copy.split("\n")[0].trim();

  for (const pattern of BANNED_OPENERS) {
    if (pattern.test(firstLine)) return fail(`banned opener matched: "${firstLine.slice(0, 60)}"`);
  }

  for (const phrase of BANNED_PHRASES) {
    if (copy.toLowerCase().includes(phrase.toLowerCase())) return fail(`banned phrase: "${phrase}"`);
  }

  if (rotationType === "lab" && endsWithQuestion(copy)) {
    return fail("lab post ends with question — needs CTA instead");
  }

  const bodyOnly  = copy.split(/\n(?=#)/)[0].trim();
  const wordCount = bodyOnly.split(/\s+/).filter(Boolean).length;
  const wordLimit = platform === "instagram" ? 100 : 200;
  if (wordCount > wordLimit) return fail(`word count ${wordCount} exceeds ${wordLimit}`);

  if (platform === "instagram") {
    const hashtagMatches = copy.match(/#[\w]+/g) ?? [];
    if (hashtagMatches.length < 23 || hashtagMatches.length > 26) {
      return fail(`hashtag count ${hashtagMatches.length} not in range 23-26`);
    }
    const tagSet = new Set(hashtagMatches.map(t => t.toLowerCase()));
    if (tagSet.size !== hashtagMatches.length) {
      return fail(`duplicate hashtags detected`);
    }
    if (/#[\w]+#/i.test(copy)) {
      return fail(`run-together hashtags detected — hashtags must be space-separated`);
    }
  }

  const sentences = copy
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 20 && !s.startsWith("#"));

  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const wordsA = sentences[i].split(" ");
      const wordsB = new Set(sentences[j].split(" "));
      const shared = wordsA.filter(w => w.length > 4 && wordsB.has(w));
      if (shared.length >= 5) {
        return fail(`repetition: "${sentences[i].slice(0, 50)}" echoes "${sentences[j].slice(0, 50)}"`);
      }
    }
  }

  return { passed: true, reason: null };
}

// ─────────────────────────────────────────────────────────────
// HALLUCINATION FIREWALL
// ─────────────────────────────────────────────────────────────

const ALLOWED_URL_PATTERNS = [
  /rebeldesigns\.co\.za/,
  /passwordroast\.netlify\.app/,
  /gamesir\.co\.za/,
];

function passesHallucinationCheck(copy) {
  const urlPattern = /https?:\/\/[^\s)>\]"']+/gi;
  const urls       = copy.match(urlPattern) ?? [];

  for (const url of urls) {
    const isAllowed = ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
    if (!isAllowed) {
      console.warn(`[generate] Hallucination detected: invented URL "${url}"`);
      return false;
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────
// NORMALISE HASHTAG OUTPUT
// ─────────────────────────────────────────────────────────────

function normaliseHashtagOutput(copy) {
  return copy
    .replace(/^\s*\[?HASHTAGS\]?\s*:?\s*$/gim, "")
    .replace(/^\s*hashtags\s*:?\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────
// TOPIC EXTRACTION — GPT-4o-mini
// ─────────────────────────────────────────────────────────────

export async function extractTopic(copy) {
  const client = requireOpenAI();

  const response = await client.chat.completions.create({
    model:      "gpt-4o-mini",
    max_tokens: 60,
    messages: [{
      role:    "user",
      content: `Summarise this social media post as a single topic description, max 12 words. Just the topic, no preamble:\n\n${copy}`,
    }],
  });
  return response.choices[0].message.content.trim();
}

// ─────────────────────────────────────────────────────────────
// IMAGE GENERATION — gpt-image-1
// ─────────────────────────────────────────────────────────────

export async function generateImage(rotation) {
  const client = requireOpenAI();

  const response = await client.images.generate({
    model:   "gpt-image-1",
    prompt:  rotation.imagePrompt,
    n:       1,
    size:    "1024x1024",
    quality: "medium",
  });

  const b64 = response.data[0].b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  return {
    buffer:   Buffer.from(b64, "base64"),
    mimeType: "image/png",
  };
}

// ─────────────────────────────────────────────────────────────
// IMAGE DOWNLOAD
// ─────────────────────────────────────────────────────────────

export async function downloadImage(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}
