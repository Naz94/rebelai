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
//   2. Upload image to Vercel Blob → get a real public imageUrl
//   3. GPT-4o Vision: analyse the image, extract developer-relevant context
//   4. Build a custom rotation brief from the vision output + user inputs
//   5. generateCopy for each requested platform
//   6. saveDraft (visual.imageUrl is now set) → publish.js can post it correctly

import { put }                       from "@vercel/blob";
import { generateCaptionFromImage }  from "../../lib/caption.js";
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
    const imageFile = formData.image ?? null;   // optional — null triggers text-only generation

    const hook         = formData.hook         ?? "";
    const context      = formData.context      ?? "";
    const angle        = formData.angle        ?? "";
    const rotationType = formData.rotationType ?? "value";
    const platforms    = formData.platforms    ?? "both";

    // ── Upload image to Vercel Blob ───────────────────────
    // This gives us a real public URL so publish.js can fetch the image
    // when the draft is approved. Without this, visual.imageUrl is null
    // and postToAllPlatforms() fails on uploaded images.
    let uploadedImageUrl = null;
    if (imageFile) {
      try {
        const blob = await put(
          `uploads/${runId}.${imageFile.mimeType.split("/")[1] ?? "jpg"}`,
          imageFile.buffer,
          {
            access:      "public",
            contentType: imageFile.mimeType,
            token:       process.env.BLOB_READ_WRITE_TOKEN,
          }
        );
        uploadedImageUrl = blob.url;
        console.log(`[${runId}] Image uploaded to Blob:`, uploadedImageUrl);
      } catch (blobErr) {
        console.error(`[${runId}] Blob upload failed:`, blobErr.message);
        // Non-fatal — draft will save but publish will fail without the URL.
        // Better to surface this now than silently later.
        return res.status(500).json({ error: `Image upload failed: ${blobErr.message}`, runId });
      }
    }

    // ── Generate captions ─────────────────────────────────
    const result = await generateCaptionFromImage({
      imageBuffer:   imageFile?.buffer   ?? null,
      imageMimeType: imageFile?.mimeType ?? "image/jpeg",
      hook,
      context,
      angle,
      rotationType,
      platforms,
    });

    // ── Save as draft ─────────────────────────────────────
    const visual = imageFile
      ? {
          type:      "uploaded",
          styleUsed: "user-upload",
          imageUrl:  uploadedImageUrl,          // ← real URL, publish.js can fetch this
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
      success:      true,
      runId,
      draftId:      draft.id,
      topic:        result.topic,
      copy:         result.copy,
      analysis:     result.analysis,
      uploadedImage: uploadedImageUrl,   // useful for dashboard preview
    });

  } catch (err) {
    console.error(`[${runId}] Caption fatal:`, err);
    return res.status(500).json({ error: err.message, runId });
  }
}

// ── Minimal multipart parser ─────────────────────────────────
// Parses a multipart/form-data request without external dependencies.
// Handles text fields and a single file field named "image".

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body        = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] ?? "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) return reject(new Error("No multipart boundary found"));

        const boundary = Buffer.from("--" + boundaryMatch[1]);
        const result   = {};

        // Split body on boundary
        let offset = 0;
        const parts = [];
        while (offset < body.length) {
          const start = indexOfBuffer(body, boundary, offset);
          if (start === -1) break;
          const end = indexOfBuffer(body, boundary, start + boundary.length);
          if (end === -1) break;
          parts.push(body.slice(start + boundary.length + 2, end - 2)); // strip \r\n
          offset = end;
        }

        for (const part of parts) {
          // Split headers from body on \r\n\r\n
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
