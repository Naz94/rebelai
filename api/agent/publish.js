// api/agent/publish.js
import { getDraft, updateDraft }  from "../../lib/drafts.js";
import { postToAllPlatforms }     from "../../lib/post.js";
import { registerPublishedPost }  from "../../lib/performance.js";
import { savePostedTopic }        from "../../lib/kv.js";
import { requireAuth }            from "../../lib/auth.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res))   return;

  const { draftId } = req.body ?? {};
  if (!draftId) return res.status(400).json({ error: "draftId required" });

  const draft = await getDraft(draftId);
  if (!draft)                       return res.status(404).json({ error: "Draft not found" });
  if (draft.status === "published") return res.status(409).json({ error: "Already published" });

  await updateDraft(draftId, { status: "approved" });

  try {
    const platformResults = await postToAllPlatforms(draft.copy, draft.visual);
    const result          = platformResults[0];
    const fbData          = result?.data?.facebook;
    const igData          = result?.data?.instagram;

    const succeeded = [fbData, igData].filter(d => d?.postId);
    const status    = succeeded.length === 2 ? "published" : succeeded.length === 1 ? "partial" : "failed";

    console.log(`[publish] Status: ${status} — FB: ${fbData?.postId ?? fbData?.error} — IG: ${igData?.postId ?? igData?.error}`);

    if (fbData?.postId) {
      await registerPublishedPost({ postId: fbData.postId, platform: "facebook", rotationId: draft.rotationId, runId: draft.runId });
    }
    if (igData?.postId) {
      await registerPublishedPost({ postId: igData.postId, platform: "instagram", rotationId: draft.rotationId, runId: draft.runId });
    }
    if (succeeded.length > 0) {
      await savePostedTopic({ topic: draft.topic, rotation: draft.rotation, rotationId: draft.rotationId, date: new Date().toISOString() });
    }

    await updateDraft(draftId, { status, publishedAt: new Date().toISOString(), platformResults });

    return res.status(200).json({
      success: succeeded.length > 0,
      status,
      facebook:  fbData,
      instagram: igData,
    });

  } catch (err) {
    console.error("[publish] Fatal:", err);
    await updateDraft(draftId, { status: "failed", error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
