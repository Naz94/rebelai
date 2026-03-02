// ============================================================
// REBEL ENGINE — Publish Endpoint (api/agent/publish.js)
//
// Called by dashboard APPROVE button.
// POST /api/agent/publish  { draftId }
// ============================================================

import { getDraft, updateDraft }    from "../../lib/drafts.js";
import { postToAllPlatforms }       from "../../lib/post.js";
import { registerPublishedPost }    from "../../lib/performance.js";
import { savePostedTopic }          from "../../lib/kv.js";
import { appendAuditLog }           from "../../lib/log.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const { draftId } = req.body ?? {};
  if (!draftId) return res.status(400).json({ error: "draftId required" });

  const draft = await getDraft(draftId);
  if (!draft)                       return res.status(404).json({ error: "Draft not found" });
  if (draft.status === "published") return res.status(409).json({ error: "Already published" });
  if (draft.status === "approved")  return res.status(409).json({ error: "Publish already in progress" });

  // Mark approved immediately — prevents double-publish
  await updateDraft(draftId, { status: "approved" });

  console.log(`[publish] Publishing draft ${draftId} — "${draft.topic}"`);

  try {
    const visual = {
      type:      draft.visual.type,
      styleUsed: draft.visual.styleUsed,
      imageUrl:  draft.visual.imageUrl,
      buffer:    draft.visual.buffer ? Buffer.from(draft.visual.buffer, "base64") : null,
      mimeType:  draft.visual.mimeType,
    };

    const platformResults = await postToAllPlatforms(draft.copy, visual);
    const succeeded = platformResults.filter(r => r.status === "SUCCESS");
    const failed    = platformResults.filter(r => r.status === "FAILED");

    const overallStatus = failed.length === 0    ? "published"
                        : succeeded.length === 0 ? "failed"
                        :                          "partial";

    const metaData = succeeded[0]?.data ?? {};

    if (metaData.facebook?.postId) {
      await registerPublishedPost({
        postId:     metaData.facebook.postId,
        platform:   "facebook",
        rotationId: draft.rotationId,
        runId:      draft.runId,
      });
    }
    if (metaData.instagram?.postId) {
      await registerPublishedPost({
        postId:     metaData.instagram.postId,
        platform:   "instagram",
        rotationId: draft.rotationId,
        runId:      draft.runId,
      });
    }

    if (succeeded.length > 0) {
      await savePostedTopic({
        topic:      draft.topic,
        rotation:   draft.rotation,
        rotationId: draft.rotationId,
        date:       new Date().toISOString(),
        runId:      draft.runId,
      });
    }

    await updateDraft(draftId, {
      status:          overallStatus,
      publishedAt:     new Date().toISOString(),
      platformResults,
      facebookPostId:  metaData.facebook?.postId  ?? null,
      instagramPostId: metaData.instagram?.postId ?? null,
    });

    await appendAuditLog({
      id:             `PUB-${Date.now()}`,
      draftId,
      runId:          draft.runId,
      rotation:       draft.rotation,
      rotationId:     draft.rotationId,
      topic:          draft.topic,
      status:         overallStatus.toUpperCase(),
      platformResults,
    });

    console.log(`[publish] Done — status: ${overallStatus}`);

    return res.status(200).json({
      success: succeeded.length > 0,
      status:  overallStatus,
      draftId,
      results: platformResults,
    });

  } catch (err) {
    console.error("[publish] Fatal:", err);
    await updateDraft(draftId, { status: "failed", error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
