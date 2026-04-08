// ============================================================
// REBEL ENGINE — Performance Brain (lib/performance.js)
// ============================================================

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const FB_API   = "https://graph.facebook.com/v19.0";
const TOKEN    = () => process.env.META_TOKEN;

const PUBLISHED_KEY    = "rebelai:published_posts";
const SCORES_KEY       = "rebelai:post_scores";
const WEIGHTS_KEY      = "rebelai:rotation_weights";
const HOOK_WEIGHTS_KEY = "rebelai:hook_weights";

const MAX_PUBLISHED = 200;

const BASE_ROTATION_WEIGHTS = {
  value_react:             50,
  value_perf:              50,
  value_css:               50,
  value_debug:             50,
  value_micro_lesson:      55,
  value_hot_take:          55,
  value_systems:           60,
  value_contrarian:        55,
  value_rulebook:          55,
  value_system_breakdown:  50,
  value_automation:        45,
  value_sa_context:        35,
  value_builder:           25,
  value_ai_systems:        50,
  lab_tool:                50,
  lab_infrastructure:      50,
};

// ─────────────────────────────────────────────────────────────
// PUBLIC — called by /api/agent/analytics?action=analyze
// ─────────────────────────────────────────────────────────────

export async function runPerformanceBrain() {
  let published;
  try {
    published = (await redis.get(PUBLISHED_KEY)) ?? [];
  } catch (err) {
    console.error("[performance] Failed to load published posts:", err.message);
    return { analysed: 0, message: "Redis error loading published posts" };
  }

  if (published.length === 0) return { analysed: 0, message: "No published posts yet" };

  console.log(`[performance] ${published.length} published records found`);
  const now      = Date.now();
  const analysed = [];
  const skipped  = [];

  for (const record of published) {
    const ageHours = (now - new Date(record.publishedAt).getTime()) / 3_600_000;

    if (ageHours < 1 || ageHours > 168 * 2) {
      skipped.push({ postId: record.postId, reason: `age_gate: ${Math.round(ageHours)}h` });
      continue;
    }

    try {
      const alreadyScored = await redis.hget(SCORES_KEY, record.postId);
      if (alreadyScored?.final) {
        skipped.push({ postId: record.postId, reason: "already_final" });
        continue;
      }
    } catch (err) {
      console.warn(`[performance] Score check failed for ${record.postId}:`, err.message);
      continue;
    }

    const insights = await fetchMetaInsights(record.postId, record.platform);
    if (!insights) {
      skipped.push({ postId: record.postId, reason: "insights_null", platform: record.platform });
      continue;
    }

    const score = scorePost(insights, ageHours);

    try {
      await redis.hset(SCORES_KEY, {
        [record.postId]: {
          ...insights,
          score,
          rotationId:  record.rotationId,
          hookStyle:   record.hookStyle ?? null,
          platform:    record.platform,
          ageHours:    Math.round(ageHours),
          final:       ageHours >= 144,
          scoredAt:    new Date().toISOString(),
          publishedAt: record.publishedAt,
        },
      });
    } catch (err) {
      console.error(`[performance] Failed to save score for ${record.postId}:`, err.message);
      continue;
    }

    analysed.push({ postId: record.postId, score, rotationId: record.rotationId });
  }

  if (analysed.length > 0) {
    await reweightRotations().catch(err => console.error("[performance] reweightRotations failed:", err.message));
    await reweightHooks().catch(err => console.error("[performance] reweightHooks failed:", err.message));
  }

  console.log(`[performance] Analysed: ${analysed.length}, Skipped: ${JSON.stringify(skipped)}`);
  return { analysed: analysed.length, posts: analysed, skipped };
}

// ─────────────────────────────────────────────────────────────
// REGISTER a newly published post
// ─────────────────────────────────────────────────────────────

export async function registerPublishedPost({ postId, platform, rotationId, hookStyle, runId }) {
  try {
    const existing = (await redis.get(PUBLISHED_KEY)) ?? [];
    existing.push({
      postId,
      platform,
      rotationId,
      hookStyle:   hookStyle ?? null,
      runId,
      publishedAt: new Date().toISOString(),
    });
    await redis.set(PUBLISHED_KEY, existing.slice(-MAX_PUBLISHED));
  } catch (err) {
    console.error("[performance] registerPublishedPost failed:", err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// GET ROTATION WEIGHTS
// ─────────────────────────────────────────────────────────────

export async function getRotationWeights() {
  try {
    const stored = await redis.hgetall(WEIGHTS_KEY);
    const merged = { ...BASE_ROTATION_WEIGHTS };
    if (stored) {
      for (const [id, w] of Object.entries(stored)) {
        if (id in merged) merged[id] = Number(w);
      }
    }
    return merged;
  } catch (err) {
    console.warn("[performance] getRotationWeights failed — using base weights:", err.message);
    return { ...BASE_ROTATION_WEIGHTS };
  }
}

// ─────────────────────────────────────────────────────────────
// GET HOOK WEIGHTS
// ─────────────────────────────────────────────────────────────

export async function getHookWeights() {
  try {
    const weights = await redis.hgetall(HOOK_WEIGHTS_KEY);
    return weights ?? {};
  } catch (err) {
    console.warn("[performance] getHookWeights failed:", err.message);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────
// FETCH INSIGHTS from Meta
// ─────────────────────────────────────────────────────────────

async function fetchMetaInsights(postId, platform) {
  if (!TOKEN()) {
    console.warn("[performance] META_TOKEN not configured — skipping insights");
    return null;
  }

  try {
    if (platform === "instagram") {
      const mediaRes  = await fetch(
        `${FB_API}/${postId}?fields=like_count,comments_count&access_token=${TOKEN()}`
      );
      const mediaData = await mediaRes.json();

      if (!mediaRes.ok || mediaData.error) {
        console.error(`[performance] IG media error for ${postId}: ${JSON.stringify(mediaData.error ?? { status: mediaRes.status })}`);
        return null;
      }
      const likes    = mediaData.like_count     ?? 0;
      const comments = mediaData.comments_count ?? 0;

      let reach = 0, impressions = 0, saves = 0;
      try {
        const insRes  = await fetch(
          `${FB_API}/${postId}/insights?metric=reach,impressions,saved&access_token=${TOKEN()}`
        );
        const insData = await insRes.json();
        if (insRes.ok && !insData.error && insData.data) {
          for (const m of insData.data) {
            if (m.name === "reach")       reach       = m.values?.[0]?.value ?? 0;
            if (m.name === "impressions") impressions = m.values?.[0]?.value ?? 0;
            if (m.name === "saved")       saves       = m.values?.[0]?.value ?? 0;
          }
        }
      } catch (insErr) {
        console.warn(`[performance] IG insights fetch failed for ${postId} (non-fatal):`, insErr.message);
      }

      console.log(`[performance] IG insights ${postId}: likes=${likes} comments=${comments} reach=${reach} saves=${saves}`);
      return { likes, comments, saves, reach, impressions, shares: 0 };

    } else {
      const fields = "likes.summary(true),comments.summary(true)";
      const res  = await fetch(
        `${FB_API}/${postId}?fields=${fields}&access_token=${TOKEN()}`
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        console.error(`[performance] FB API error for ${postId}: ${JSON.stringify(data.error ?? { status: res.status })}`);
        return null;
      }
      const likes    = data.likes?.summary?.total_count    ?? 0;
      const comments = data.comments?.summary?.total_count ?? 0;

      console.log(`[performance] FB photo insights ${postId}: likes=${likes} comments=${comments}`);
      return { likes, comments, saves: 0, reach: 0, impressions: 0, shares: 0 };
    }
  } catch (err) {
    console.error(`[performance] fetchMetaInsights threw for ${postId}:`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// SCORE a post 0–100
// ─────────────────────────────────────────────────────────────

function scorePost(insights, ageHours) {
  const { likes, comments, saves, reach, impressions, shares } = insights;

  const engagements = likes + (comments * 3) + (saves * 5) + (shares * 4);
  const engRate     = reach > 0 ? (engagements / reach) * 100 : 0;
  const reachEff    = impressions > 0 ? (reach / impressions) * 100 : 0;

  const rawScore = Math.min(100,
    (engRate   * 4.0) +
    (reachEff  * 0.5) +
    (saves     * 2.0) +
    (comments  * 1.5) +
    (shares    * 1.0)
  );

  return Math.round(rawScore);
}

// ─────────────────────────────────────────────────────────────
// RE-WEIGHT rotations
// ─────────────────────────────────────────────────────────────

async function reweightRotations() {
  const allScores = await redis.hgetall(SCORES_KEY);
  if (!allScores) return;

  const byRotation = {};
  for (const [, data] of Object.entries(allScores)) {
    const r = data.rotationId;
    const s = data.score ?? 0;
    if (!r) continue;
    if (!byRotation[r]) byRotation[r] = [];
    byRotation[r].push(s);
  }

  const averages = {};
  for (const [rotId, scores] of Object.entries(byRotation)) {
    averages[rotId] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  if (Object.keys(averages).length === 0) return;

  const maxAvg = Math.max(...Object.values(averages), 1);
  const newWeights = {};
  for (const [rotId, avg] of Object.entries(averages)) {
    newWeights[rotId] = Math.round(30 + (avg / maxAvg) * 65);
  }

  await redis.hset(WEIGHTS_KEY, newWeights);
}

// ─────────────────────────────────────────────────────────────
// RE-WEIGHT hooks
// ─────────────────────────────────────────────────────────────

async function reweightHooks() {
  const allScores = await redis.hgetall(SCORES_KEY);
  if (!allScores) return;

  const byHook = {};
  for (const [, data] of Object.entries(allScores)) {
    const h = data.hookStyle;
    const s = data.score ?? 0;
    if (!h) continue;
    if (!byHook[h]) byHook[h] = [];
    byHook[h].push(s);
  }

  if (Object.keys(byHook).length === 0) return;

  const averages = {};
  for (const [hookId, scores] of Object.entries(byHook)) {
    averages[hookId] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  const maxAvg = Math.max(...Object.values(averages), 1);
  const newWeights = {};
  for (const [hookId, avg] of Object.entries(averages)) {
    newWeights[hookId] = Math.round(30 + (avg / maxAvg) * 65);
  }

  await redis.hset(HOOK_WEIGHTS_KEY, newWeights);
}
