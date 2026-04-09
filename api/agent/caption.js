// api/agent/caption.js
//
// Accepts a multipart POST with:
//   - image        (File)   — optional: if omitted, generation uses hook + context only
//   - hook         (string) — optional: the angle or first-line idea
//   - context      (string) — optional: background info about the image
//   - angle        (string) — optional: Contrarian / Breakdown / Hidden Cost / etc.
//   - rotationType (string) — "value" | "lab"
//   - platforms    (string) — "both" | "facebook" | "instagram"
//
// Flow:
//   1. Parse multipart form
//   2. lib/caption.js: upload image to Blob, analyse with Vision, generate copy
//   3. saveDraft → returns draftId for dashboard review queue

import { generateCaptionFromImage } from "../../lib/caption.js";
import { saveDraft }                 from "../../lib/drafts.js";
import { saveLastRun }               from "../../lib/kv.js";
import { requireAuth }               from "../../lib/auth.js";

export const maxDuration = 60;
export const config = { api: { bodyParser: false } };   // required for multipart

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res))   return;

  const runId = `RD-CAP-${Date.now()}`;

  try {
    // ── Parse multipart form ──────────────────────────────
    const formData  = await parseMultipart(req);
    const imageFile = formData.image ?? null;

    const hook         = formData.hook         ?? "";
    const context      = formData.context      ?? "";
    const angle        = formData.angle        ?? "";
    const rotationType = formData.rotationType ?? "value";
    const platforms    = formData.platforms    ?? "both";

    // ── Generate captions ─────────────────────────────────
    // lib/caption.js handles: Blob upload → Vision analysis → copy generation
    const result = await generateCaptionFromImage({
      imageBuffer:   imageFile?.buffer   ?? null,
      imageMimeType: imageFile?.mimeType ?? "image/jpeg",
      hook,
      context,
      angle,
      rotationType,
      platforms,
    });

    // ── Build visual object ───────────────────────────────
    // imageUrl comes from lib/caption.js as a permanent Blob URL.
    // buffer stored as base64 fallback for publish.js if Blob ever fails.
    const visual = imageFile
      ? {
          type:      "uploaded",
          styleUsed: "user-upload",
          imageUrl:  result.imageUrl,            // permanent Blob URL
          mimeType:  imageFile.mimeType,
          buffer:    imageFile.buffer.toString("base64"),
        }
      : {
          type:      "none",
          styleUsed: "text-only",
          imageUrl:  null,
          mimeType:  null,
        };

    // ── Save as draft ─────────────────────────────────────
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
      imageUrl: result.imageUrl,
      analysis: result.analysis,
    });

  } catch (err) {
    console.error(`[${runId}] Caption fatal:`, err);
    return res.status(500).json({ error: err.message, runId });
  }
}

// ── Minimal multipart parser ─────────────────────────────────

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

        let offset = 0;
        const parts = [];
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

          const headerBlock = part.slice(0, headerEnd).toString("utf8");
          const partBody    = part.slice(headerEnd + 4);

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
