// api/agent/fire.js
import { getPostedTopics, saveLastRun }  from "../../lib/kv.js";
import { getWeightedRotation }           from "../../lib/rotations.js";
import { generateCopy, extractTopic }    from "../../lib/generate.js";
import { generateVisual }                from "../../lib/visual.js";
import { fetchResourceSnapshot }         from "../../lib/resources.js";
import { getRotationWeights }            from "../../lib/performance.js";
import { getIntelligenceBrief }          from "../../lib/trends.js";
import { saveDraft }                     from "../../lib/drafts.js";
import { requireAuth }                   from "../../lib/auth.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Allow Vercel cron (GET with x-vercel-cron header) OR authenticated POST
  const isCron = req.method === "GET" && req.headers["x-vercel-cron"];
  if (!isCron && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isCron && !requireAuth(req, res)) return;

  const runId = `RD-${Date.now()}`;

  try {
    const [postHistory, resourceSnapshot, rotationWeights, intelligenceBrief] = await Promise.all([
      getPostedTopics(),
      fetchResourceSnapshot(),
      getRotationWeights(),
      getIntelligenceBrief(),
    ]);

    const rotation = getWeightedRotation(rotationWeights);

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
      rotation:     rotation.name,
      rotationId:   rotation.id,
      rotationType: rotation.type,
      topic,
      copy: { facebook: facebookCopy, instagram: instagramCopy },
      visual: {
        type:      visual.type,
        styleUsed: visual.styleUsed,
        imageUrl:  visual.imageUrl ?? null,
        mimeType:  visual.mimeType ?? "image/png",
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
      rotationType: rotation.type,   // FIX: was missing — toast showed empty brackets
    });

  } catch (err) {
    console.error(`[${runId}] Fatal:`, err);
    return res.status(500).json({ error: err.message, runId });
  }
}
