// ============================================================
// REBEL ENGINE — Main Agent Route (api/agent/fire.js)
//
// Triggered by Vercel Cron every Tuesday and Friday at 08:00 SAST.
// Can also be manually triggered (with the secret header) for testing.
//
// Sequence:
//   1. Auth check — Vercel Cron secret or manual x-agent-secret
//   2. Rotation index from KV → determines content type
//   3. Resource snapshot → prevents Claude hallucinating URLs
//   4. Claude generates copy for all 3 platforms in parallel
//   5. DALL-E 3 generates the image
//   6. postToAllPlatforms() dispatches to Meta + LinkedIn
//      (Promise.allSettled — one platform down ≠ total failure)
//   7. appendAuditLog() commits record to GitHub (PAIA Section 51)
//   8. KV updated — rotation advances, topic saved
// ============================================================

import { getAndAdvanceRotation, saveLastRun } from "../../lib/kv.js";
import { getRotation }                        from "../../lib/rotations.js";
import { generateCopy, generateImage }        from "../../lib/generate.js";
import { postToAllPlatforms }                 from "../../lib/post.js";
import { appendAuditLog }                     from "../../lib/log.js";
import { fetchResourceSnapshot }              from "../../lib/resources.js";

export const maxDuration = 60; // Vercel Hobby max — upgrade to Pro for 300s

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: Vercel Cron sends x-vercel-cron-secret automatically.
  // For manual test fires, pass x-agent-secret with the same value.
  const secret = req.headers["x-vercel-cron-secret"] ?? req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const runId = `RD-${Date.now()}`;
  console.log(`[${runId}] Agent firing...`);

  try {
    // ── 1. Rotation ──────────────────────────────────────────────
    const rotationIndex = await getAndAdvanceRotation();
    const rotation      = getRotation(rotationIndex);
    console.log(`[${runId}] Rotation: ${rotation.name}`);

    // ── 2. Resource snapshot (anti-hallucination) ────────────────
    const resourceSnapshot = await fetchResourceSnapshot();
    console.log(`[${runId}] Resources: ${resourceSnapshot.source}`);

    // ── 3. Generate copy — all 3 platforms in parallel ───────────
    console.log(`[${runId}] Generating copy...`);
    const [linkedinCopy, facebookCopy, instagramCopy] = await Promise.all([
      generateCopy(rotation, "linkedin",  resourceSnapshot),
      generateCopy(rotation, "facebook",  resourceSnapshot),
      generateCopy(rotation, "instagram", resourceSnapshot),
    ]);

    const contentMap = {
      linkedin:  linkedinCopy,
      facebook:  facebookCopy,
      instagram: instagramCopy,
    };

    // ── 4. Generate image ────────────────────────────────────────
    console.log(`[${runId}] Generating image...`);
    const imageUrl = await generateImage(rotation);

    // ── 5. Dispatch to all platforms ─────────────────────────────
    // postToAllPlatforms uses Promise.allSettled internally.
    // Meta (FB + IG) and LinkedIn run as independent groups.
    // One group failing does not prevent the other from posting.
    console.log(`[${runId}] Dispatching to platforms...`);
    const platformResults = await postToAllPlatforms(contentMap, imageUrl);

    const succeeded = platformResults.filter(r => r.status === "SUCCESS");
    const failed    = platformResults.filter(r => r.status === "FAILED");

    if (failed.length > 0) {
      console.warn(`[${runId}] Platform failures:`, failed.map(f => `${f.platform}: ${f.error}`));
    }

    // ── 6. PAIA Audit Log → GitHub ───────────────────────────────
    await appendAuditLog({
      id:                    runId,
      rotation:              rotation.name,
      rotationId:            rotation.id,
      resourceSnapshotSource: resourceSnapshot.source,
      platformResults,
      copy:                  contentMap,
      imagePrompt:           rotation.imagePrompt,
    });

    // ── 7. Save last run summary to KV (lightweight monitoring) ──
    const overallStatus = failed.length === 0 ? "SUCCESS"
                        : succeeded.length === 0 ? "ERROR"
                        : "PARTIAL";

    await saveLastRun({ id: runId, rotation: rotation.name, status: overallStatus, platformResults });

    console.log(`[${runId}] Done — ${overallStatus}`);

    return res.status(200).json({
      success: true,
      runId,
      rotation: rotation.name,
      status:   overallStatus,
      platformResults,
    });

  } catch (err) {
    console.error(`[${runId}] Fatal:`, err);
    await saveLastRun({ id: runId, status: "ERROR", error: err.message }).catch(() => {});
    return res.status(500).json({ error: err.message, runId });
  }
}
