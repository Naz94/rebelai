// ============================================================
// REBEL ENGINE — Content Router (api/agent/content.js)
//
// Routes via ?action= query param:
//   POST/GET ?action=generate  — fire the AI content engine (cron or dashboard)
//   POST     ?action=caption   — generate captions from uploaded image
//   POST/GET (no action)       — same as generate (backwards compat)
// ============================================================

import { getPostedTopics, saveLastRun }                  from "../../lib/kv.js";
import { getWeightedRotation, pickAngle, pickHookStyle }  from "../../lib/rotations.js";
import { generateCopy, extractTopic }                     from "../../lib/generate.js";
import { generateVisual }                                 from "../../lib/visual.js";
import { fetchResourceSnapshot }                          from "../../lib/resources.js";
import { getRotationWeights }                             from "../../lib/performance.js";
import { getIntelligenceBrief }                           from "../../lib/trends.js";
import { saveDraft }                                      from "../../lib/drafts.js";
import { generateCaptionFromImage }                       from "../../lib/caption.js";
import { requireAuth }                                    from "../../lib/auth.js";

export const maxDuration = 60;

// multipart required for caption uploads — bodyParser disabled globally
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action ?? "generate";
  const isCron = req.headers["x-vercel-cron"] === "1";

  // ── CAPTION — image upload flow ───────────────────────────
  if (action === "caption") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!requireAuth(req, res)) return;
    return handleCaption(req, res);
  }

  // ── GENERATE — AI content engine ─────────────────────────
  if (!isCron && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isCron && !requireAuth(req, res)) return;
  return handleGenerate(req, res);
}

// ─────────────────────────────────────────────────────────────
// GENERATE
// ─────────────────────────────────────────────────────────────

async function handleGenerate(req, res) {
  const runId = `RD-${Date.now()}`;
  try {
    const [postHistory, resourceSnapshot, rotationWeights, intelligenceBrief] = await Promise.all([
      getPostedTopics(),
      fetchResourceSnapshot(),
      getRotationWeights(),
      getIntelligenceBrief(),
    ]);

    const rotation  = getWeightedRotation(rotationWeights);
    const angle     = pickAngle(rotation, postHistory);
    const hookStyle = pickHookStyle(rotation);

    const [fbResult, igResult] = await Promise.all([
      generateCopy(rotation, "facebook",  resourceSnapshot, postHistory, intelligenceBrief, { angle, hookStyle }),
      generateCopy(rotation, "instagram", resourceSnapshot, postHistory, intelligenceBrief, { angle, hookStyle }),
    ]);

    const facebookCopy  = fbResult.copy;
    const instagramCopy = igResult.copy;

    // runId passed so the Blob filename is traceable (rebelai/visuals/RD-{ts}-{style}.png)
    const [topic, visual] = await Promise.all([
      extractTopic(facebookCopy),
      generateVisual(rotation, facebookCopy, runId),
    ]);

    const draft = await saveDraft({
      runId,
      rotation:     rotation.name,
      rotationId:   rotation.id,
      rotationType: rotation.type,
      hookStyle,
      angle,
      topic,
      copy:    { facebook: facebookCopy, instagram: instagramCopy },
      visual:  {
        type:      visual.type,
        styleUsed: visual.styleUsed,
        imageUrl:  visual.imageUrl ?? null,
        mimeType:  visual.mimeType ?? "image/png",
        // buffer intentionally omitted — Blob URL is the source of truth for AI-generated drafts
      },
      status:    "pending",
      createdAt: new Date().toISOString(),
    });

    await saveLastRun({ runId, rotation: rotation.name, topic, status: "DRAFT_SAVED" });

    return res.status(200).json({
      success:      true,
      runId,
      draftId:      draft.id,
      status:       draft.status,
      topic,
      rotationType: rotation.type,
    });
  } catch (err) {
    console.error(`[${runId}] Generate fatal:`, err);
    return res.status(500).json({ error: err.message, runId });
  }
}

// ─────────────────────────────────────────────────────────────
// CAPTION
// ─────────────────────────────────────────────────────────────

async function handleCaption(req, res) {
  const runId = `RD-CAP-${Date.now()}`;
  try {
    const formData  = await parseMultipart(req);
    const imageFile = formData.image ?? null;

    const hook         = formData.hook         ?? "";
    const context      = formData.context      ?? "";
    const angle        = formData.angle        ?? "";
    const rotationType = formData.rotationType ?? "value";
    const platforms    = formData.platforms    ?? "both";

    const result = await generateCaptionFromImage({
      imageBuffer:   imageFile?.buffer   ?? null,
      imageMimeType: imageFile?.mimeType ?? "image/jpeg",
      hook,
      context,
      angle,
      rotationType,
      platforms,
    });

    // Caption uploads: store buffer as base64 for Facebook fallback.
    // imageUrl may be null here — post.js handles that gracefully.
    const visual = imageFile
      ? {
          type:      "uploaded",
          styleUsed: "user-upload",
          imageUrl:  result.imageUrl ?? null,
          mimeType:  imageFile.mimeType,
          buffer:    imageFile.buffer.toString("base64"),
        }
      : {
          type:      "none",
          styleUsed: "text-only",
          imageUrl:  null,
          mimeType:  null,
        };

    const draft = await saveDraft({
      runId,
      rotation:     "Custom Caption",
      rotationId:   "custom_caption",
      rotationType,
      topic:        result.topic,
      hookStyle:    angle || "custom",
      angle:        angle || "custom",
      copy:         result.copy,
      visual,
      status:    "pending",
      createdAt: new Date().toISOString(),
    });

    await saveLastRun({ runId, rotation: "Custom Caption", topic: result.topic, status: "DRAFT_SAVED" });

    return res.status(200).json({
      success:  true,
      runId,
      draftId:  draft.id,
      topic:    result.topic,
      copy:     result.copy,
      analysis: result.analysis,
    });
  } catch (err) {
    console.error(`[${runId}] Caption fatal:`, err);
    return res.status(500).json({ error: err.message, runId });
  }
}

// ─────────────────────────────────────────────────────────────
// MULTIPART PARSER (inline — no external deps)
// ─────────────────────────────────────────────────────────────

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body          = Buffer.concat(chunks);
        const contentType   = req.headers["content-type"] ?? "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) return reject(new Error("No multipart boundary found"));

        const boundary = Buffer.from("--" + boundaryMatch[1]);
        const result   = {};
        let offset     = 0;
        const parts    = [];

        while (offset < body.length) {
          const start = indexOfBuffer(body, boundary, offset);
          if (start === -1) break;
          const end = indexOfBuffer(body, boundary, start + boundary.length);
          if (end === -1) break;
          parts.push(body.slice(start + boundary.length + 2, end - 2));
          offset = end;
        }

        for (const part of parts) {
          const headerEnd = indexOfBuffer(part, Buffer.from("\r\n\r\n"), 0);
          if (headerEnd === -1) continue;

          const headerBlock   = part.slice(0, headerEnd).toString("utf8");
          const partBody      = part.slice(headerEnd + 4);
          const nameMatch     = headerBlock.match(/name="([^"]+)"/);
          const filenameMatch = headerBlock.match(/filename="([^"]+)"/);
          const mimeMatch     = headerBlock.match(/Content-Type:\s*([^\r\n]+)/i);

          if (!nameMatch) continue;
          const fieldName = nameMatch[1];

          if (filenameMatch) {
            result[fieldName] = {
              filename: filenameMatch[1],
              mimeType: mimeMatch ? mimeMatch[1].trim() : "application/octet-stream",
              buffer:   partBody,
            };
          } else {
            result[fieldName] = partBody.toString("utf8").trim();
          }
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function indexOfBuffer(haystack, needle, offset = 0) {
  for (let i = offset; i <= haystack.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}
