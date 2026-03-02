// ============================================================
// REBEL AI — Main Agent (api/agent/fire.js)
// ============================================================

import { getPostedTopics, saveLastRun }  from "../../lib/kv.js";
import { getWeightedRotation }           from "../../lib/rotations.js";
import { generateCopy, extractTopic }    from "../../lib/generate.js";
import { generateVisual }                from "../../lib/visual.js";
import { appendAuditLog }                from "../../lib/log.js";
import { fetchResourceSnapshot }         from "../../lib/resources.js";
import { getRotationWeights }            from "../../lib/performance.js";
import { getIntelligenceBrief }          from "../../lib/trends.js";
import { saveDraft }                     from "../../lib/drafts.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-vercel-cron-secret"] ?? req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const runId = `RD-${Date.now()}`;
  console.log(`[${runId}] Agent firing...`);

  try {
    const [postHistory, resourceSnapshot, rotationWeights, intelligenceBrief] = await Promise.all([
      getPostedTopics(),
      fetchResourceSnapshot(),
      getRotationWeights(),
      getIntelligenceBrief(),
    ]);

    const rotation = getWeightedRotation(rotationWeights);
    console.log(`[${runId}] Rotation: ${rotation.name} (${rotation.type})`);

    const [facebookCopy, instagramCopy] = await Promise.all([
      generateCopy(rotation, "facebook",  resourceSnapshot, postHistory, intelligenceBrief),
      generateCopy(rotation, "instagram", resourceSnapshot, postHistory, intelligenceBrief),
    ]);

    const [topic, visual] = await Promise.all([
      extractTopic(facebookCopy),
      generateVisual(rotation),
    ]);

    const draft = await saveDraft({
      runId,
      rotation:    rotation.name,
      rotationId:  rotation.id,
      rotationType: rotation.type,
      topic,
      copy: {
        facebook:  facebookCopy,
        instagram: instagramCopy,
      },
      visual: {
        type:      visual.type,
        styleUsed: visual.styleUsed,
        imageUrl:  visual.imageUrl ?? null,
        mimeType:  visual.mimeType ?? "image/png",
      },
      status:    "pending",
      createdAt: new Date().toISOString(),
    });

    console.log(`[${runId}] Draft saved — ID: ${draft.id} — status: ${draft.status}`);

    await saveLastRun({ runId, rotation: rotation.name, topic, status: "DRAFT_SAVED" });

    return res.status(200).json({
      runId,
      draftId: draft.id,
      status:  "DRAFT_SAVED",
      topic,
      rotation: rotation.name,
      rotationType: rotation.type,
      message: "Draft saved. Open Review Queue to approve.",
    });

  } catch (err) {
    console.error(`[${runId}] Fatal:`, err);
    await saveLastRun({ runId, status: "FATAL", error: err.message }).catch(() => {});
    return res.status(500).json({ error: err.message, runId });
  }
}
