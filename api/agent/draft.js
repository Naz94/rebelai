// ============================================================
// REBEL ENGINE — Draft Actions (api/agent/draft.js)
//
// PATCH /api/agent/draft  { draftId, action: "reject" }
// POST  /api/agent/draft  { draftId, action: "regenerate" }
// ============================================================

import { getDraft, updateDraft, saveDraft } from "../../lib/drafts.js";
import { generateCopy, extractTopic }       from "../../lib/generate.js";
import { getWeightedRotation, ROTATIONS }   from "../../lib/rotations.js";
import { getPostedTopics }                  from "../../lib/kv.js";
import { fetchResourceSnapshot }            from "../../lib/resources.js";
import { getIntelligenceBrief }             from "../../lib/trends.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const { draftId, action } = req.body ?? {};
  if (!draftId || !action) return res.status(400).json({ error: "draftId and action required" });

  const draft = await getDraft(draftId);
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  // ── REJECT ────────────────────────────────────────────────
  if (action === "reject") {
    await updateDraft(draftId, { status: "rejected", rejectedAt: new Date().toISOString() });
    return res.status(200).json({ success: true, status: "rejected" });
  }

  // ── REGENERATE copy (keeps image) ─────────────────────────
  if (action === "regenerate") {
    // Find the original rotation by ID
    const rotation = ROTATIONS.find(r => r.id === draft.rotationId)
      ?? ROTATIONS[0];

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

    const newDraft = await saveDraft({
      runId:      draft.runId,
      rotation:   draft.rotation,
      rotationId: draft.rotationId,
      rotationType: draft.rotationType,
      topic,
      copy: { facebook: facebookCopy, instagram: instagramCopy },
      visual:     draft.visual,
      status:     "pending",
      createdAt:  new Date().toISOString(),
      regeneratedFrom: draftId,
    });

    return res.status(200).json({ success: true, draftId: newDraft.id, topic });
  }

  return res.status(400).json({ error: "Unknown action" });
}
