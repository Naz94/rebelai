// api/agent/draft.js
import { getDraft, updateDraft, saveDraft } from "../../lib/drafts.js";
import { generateCopy, extractTopic }       from "../../lib/generate.js";
import { ROTATIONS }                        from "../../lib/rotations.js";
import { getPostedTopics }                  from "../../lib/kv.js";
import { fetchResourceSnapshot }            from "../../lib/resources.js";
import { getIntelligenceBrief }             from "../../lib/trends.js";
import { requireAuth }                      from "../../lib/auth.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res))   return;

  const { draftId, action } = req.body ?? {};
  if (!draftId || !action) return res.status(400).json({ error: "draftId and action required" });

  const draft = await getDraft(draftId);
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  if (action === "reject") {
    await updateDraft(draftId, { status: "rejected" });
    return res.status(200).json({ success: true });
  }

  if (action === "regenerate") {
    const rotation = ROTATIONS.find(r => r.id === draft.rotationId) ?? ROTATIONS[0];
    const [postHistory, resourceSnapshot, intelligenceBrief] = await Promise.all([
      getPostedTopics(),
      fetchResourceSnapshot(),
      getIntelligenceBrief(),
       ]);
    const [facebookCopy, instagramCopy] = await Promise.all([
      generateCopy(rotation, "facebook",  resourceSnapshot, postHistory, intelligenceBrief),
      generateCopy(rotation, "instagram", resourceSnapshot, postHistory, intelligenceBrief),
    ]);
    const topic = await extractTopic(facebookCopy);
    await updateDraft(draftId, { status: "regenerated" });

    // saveDraft always generates a fresh ID — don't pass old id in spread
    const newDraft = await saveDraft({
      runId:        draft.runId,
      rotation:     draft.rotation,
      rotationId:   draft.rotationId,
      rotationType: draft.rotationType,
      visual:       draft.visual,
      topic,
      copy: { facebook: facebookCopy, instagram: instagramCopy },
      status:    "pending",
      createdAt: new Date().toISOString(),
    });
    return res.status(200).json({ success: true, draftId: newDraft.id, topic });
  }

  return res.status(400).json({ error: "Unknown action" });
}
