// ============================================================
// REBEL ENGINE — Main Agent Route (api/agent/fire.js)
//
// Triggered by Vercel Cron every Tuesday and Friday at 08:00 SAST.
// Can also be manually triggered (with x-agent-secret header).
//
// Platforms: Facebook + Instagram (Meta only — LinkedIn coming later)
//
// Sequence:
//   1. Auth check
//   2. Rotation index from Redis → determines content type
//   3. Resource snapshot → prevents Claude hallucinating URLs
//   4. Claude generates copy for Facebook + Instagram in parallel
//   5. DALL-E 3 generates the image
//   6. postToAllPlatforms() → Meta dispatcher (FB + IG)
//   7. appendAuditLog() → commits PAIA record to GitHub
//   8. Redis updated — rotation advances
// ============================================================

import { getAndAdvanceRotation, saveLastRun } from “../../lib/kv.js”;
import { getRotation }                        from “../../lib/rotations.js”;
import { generateCopy, generateImage }        from “../../lib/generate.js”;
import { postToAllPlatforms }                 from “../../lib/post.js”;
import { appendAuditLog }                     from “../../lib/log.js”;
import { fetchResourceSnapshot }              from “../../lib/resources.js”;

export const maxDuration = 60;

export default async function handler(req, res) {
if (req.method !== “POST”) {
return res.status(405).json({ error: “Method not allowed” });
}

// Auth: Vercel Cron sends x-vercel-cron-secret automatically.
// For manual test fires use: -H “x-agent-secret: YOUR_CRON_SECRET”
const secret = req.headers[“x-vercel-cron-secret”] ?? req.headers[“x-agent-secret”];
if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== “development”) {
return res.status(401).json({ error: “Unauthorised” });
}

const runId = `RD-${Date.now()}`;
console.log(`[${runId}] Agent firing...`);

try {
// ── 1. Rotation ──────────────────────────────────────────────
const rotationIndex = await getAndAdvanceRotation();
const rotation      = getRotation(rotationIndex);
console.log(`[${runId}] Rotation: ${rotation.name}`);

```
// ── 2. Resource snapshot (anti-hallucination) ────────────────
const resourceSnapshot = await fetchResourceSnapshot();
console.log(`[${runId}] Resources: ${resourceSnapshot.source}`);

// ── 3. Generate copy — Facebook + Instagram in parallel ──────
console.log(`[${runId}] Generating copy...`);
const [facebookCopy, instagramCopy] = await Promise.all([
  generateCopy(rotation, "facebook",  resourceSnapshot),
  generateCopy(rotation, "instagram", resourceSnapshot),
]);

const contentMap = {
  facebook:  facebookCopy,
  instagram: instagramCopy,
};

// ── 4. Generate image ────────────────────────────────────────
console.log(`[${runId}] Generating image...`);
const imageUrl = await generateImage(rotation);

// ── 5. Dispatch to Meta (FB + IG) ────────────────────────────
console.log(`[${runId}] Dispatching to Meta...`);
const platformResults = await postToAllPlatforms(contentMap, imageUrl);

const succeeded = platformResults.filter(r => r.status === "SUCCESS");
const failed    = platformResults.filter(r => r.status === "FAILED");

if (failed.length > 0) {
  console.warn(`[${runId}] Failures:`, failed.map(f => `${f.platform}: ${f.error}`));
}

// ── 6. PAIA Audit Log → GitHub ───────────────────────────────
await appendAuditLog({
  id:                     runId,
  rotation:               rotation.name,
  rotationId:             rotation.id,
  resourceSnapshotSource: resourceSnapshot.source,
  platformResults,
  copy:                   contentMap,
  imagePrompt:            rotation.imagePrompt,
});

// ── 7. Save last run to Redis (lightweight monitoring) ────────
const overallStatus = failed.length === 0   ? "SUCCESS"
                    : succeeded.length === 0 ? "ERROR"
                    : "PARTIAL";

await saveLastRun({
  id: runId,
  rotation: rotation.name,
  status: overallStatus,
  platformResults,
});

console.log(`[${runId}] Done — ${overallStatus}`);

return res.status(200).json({
  success: true,
  runId,
  rotation: rotation.name,
  status:   overallStatus,
  platformResults,
});
```

} catch (err) {
console.error(`[${runId}] Fatal:`, err);
await saveLastRun({ id: runId, status: “ERROR”, error: err.message }).catch(() => {});
return res.status(500).json({ error: err.message, runId });
}
}