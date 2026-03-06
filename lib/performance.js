// ============================================================
// REBEL ENGINE — Performance Brain (lib/performance.js)
//
// Runs every 6 hours via cron: /api/agent/analyze
//
// For every published post:
//   1. Pulls Meta Insights (likes, reach, engagement, saves, clicks)
//   2. Scores the post 0–100
//   3. Saves score to Redis
//   4. Re-weights rotation priorities based on what is working
//   5. Re-weights hook styles based on what signals each one produces
//
// Rotation IDs: value_react, value_perf, value_css, value_debug,
//               value_micro_lesson, value_hot_take, value_systems,
//               value_contrarian, value_rulebook, value_system_breakdown,
//               value_automation, value_sa_context, value_builder,
//               value_ai_systems,
//               lab_tool, lab_infrastructure
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

// ─────────────────────────────────────────────────────────────
// PUBLIC — called by /api/agent/analyze
// ─────────────────────────────────────────────────────────────

export async function runPerformanceBrain() {
  const published = (await redis.get(PUBLISHED_KEY)) ?? [];
  if (published.length === 0) return { analysed: 0, message: "No published posts yet" };

  const now      = Date.now();
  const analysed = [];

  for (const record of published) {
    const ageHours = (now - new Date(record.publishedAt).getTime()) / 3_600_000;

    // Only analyse posts 24h+ old, not yet finally scored at 7d+
    if (ageHours < 23 || ageHours > 168 * 2) continue;

    const alreadyScored = await redis.hget(SCORES_KEY, record.postId);
    if (alreadyScored?.final) continue;

    const insights = await fetchMetaInsights(record.postId, record.platform);
    if (!insights) continue;

    const score = scorePost(insights, ageHours);

    await redis.hset(SCORES_KEY, {
      [record.postId]: {
        ...insights,
        score,
        rotationId:  record.rotationId,
        hookStyle:   record.hookStyle  ?? null,
        angle:       record.angle      ?? null,
        platform:    record.platform,
        ageHours:    Math.round(ageHours),
        final:       ageHours >= 144,
        scoredAt:    new Date().toISOString(),
        publishedAt: record.publishedAt,
      },
    });

    analysed.push({ postId: record.postId, score, rotationId: record.rotationId, hookStyle: record.hookStyle });
  }

  if (analysed.length > 0) {
    await reweightRotations();
    await reweightHookStyles();
    await reweightAngles();
  }

  return { analysed: analysed.length, posts: analysed };
}

// ─────────────────────────────────────────────────────────────
// REGISTER a newly published post
// Now also stores hookStyle and angle so the feedback loop
// can learn which opening patterns drive each engagement signal.
// ─────────────────────────────────────────────────────────────

export async function registerPublishedPost({ postId, platform, rotationId, runId, hookStyle = null, angle = null }) {
  const existing = (await redis.get(PUBLISHED_KEY)) ?? [];
  existing.push({
    postId,
    platform,
    rotationId,
    runId,
    hookStyle,
    angle,
    publishedAt: new Date().toISOString(),
  });
  await redis.set(PUBLISHED_KEY, existing.slice(-200));
}

// ─────────────────────────────────────────────────────────────
// GET ROTATION WEIGHTS — used by fire.js to pick rotation
// ─────────────────────────────────────────────────────────────

export async function getRotationWeights() {
  const weights = await redis.hgetall(WEIGHTS_KEY);

  return {
    // Web Dev Craft
    value_react:             Number(weights?.value_react             ?? 50),
    value_perf:              Number(weights?.value_perf              ?? 50),
    value_css:               Number(weights?.value_css               ?? 50),
    value_debug:             Number(weights?.value_debug             ?? 50),
    value_micro_lesson:      Number(weights?.value_micro_lesson      ?? 55),
    value_hot_take:          Number(weights?.value_hot_take          ?? 55),
    // Infrastructure & Systems
    value_systems:           Number(weights?.value_systems           ?? 60),
    value_contrarian:        Number(weights?.value_contrarian        ?? 55),
    value_rulebook:          Number(weights?.value_rulebook          ?? 55),
    value_system_breakdown:  Number(weights?.value_system_breakdown  ?? 50),
    // Automation & AI
    value_automation:        Number(weights?.value_automation        ?? 45),
    // SA Tech Context
    value_sa_context:        Number(weights?.value_sa_context        ?? 35),
    // Founder / Builder
    value_builder:           Number(weights?.value_builder           ?? 25),
    value_ai_systems:        Number(weights?.value_ai_systems        ?? 50),
    // Lab rotations
    lab_tool:                Number(weights?.lab_tool                ?? 50),
    lab_infrastructure:      Number(weights?.lab_infrastructure      ?? 50),
  };
}

// ─────────────────────────────────────────────────────────────
// GET HOOK WEIGHTS — used by rotations.js pickHookStyle
// Returns a weight score per hook style so the most effective
// openers are selected more often over time.
// Normalised to 10–100. Defaults to 50 until data exists.
// ─────────────────────────────────────────────────────────────

export async function getHookWeights() {
  const raw = await redis.hgetall(HOOK_WEIGHTS_KEY);
  if (!raw) return {};

  const weights = {};
  for (const [style, data] of Object.entries(raw)) {
    weights[style] = Number(data?.weight ?? 50);
  }
  return weights;
}

// ─────────────────────────────────────────────────────────────
// FETCH INSIGHTS from Meta
// ─────────────────────────────────────────────────────────────

async function fetchMetaInsights(postId, platform) {
  try {
    const fields = platform === "instagram"
      ? "like_count,comments_count,saved,reach,impressions,shares_count"
      : "likes.summary(true),comments.summary(true),shares,reach,impressions";

    const res  = await fetch(`${FB_API}/${postId}?fields=${fields}&access_token=${TOKEN()}`);
    const data = await res.json();
    if (!res.ok || data.error) return null;

    if (platform === "instagram") {
      return {
        likes:       data.like_count        ?? 0,
        comments:    data.comments_count    ?? 0,
        saves:       data.saved             ?? 0,
        reach:       data.reach             ?? 0,
        impressions: data.impressions       ?? 0,
        shares:      data.shares_count      ?? 0,
      };
    } else {
      return {
        likes:       data.likes?.summary?.total_count    ?? 0,
        comments:    data.comments?.summary?.total_count ?? 0,
        saves:       0,
        reach:       data.reach       ?? 0,
        impressions: data.impressions ?? 0,
        shares:      data.shares?.count ?? 0,
      };
    }
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// SCORE a post 0–100
// Saves and comments weighted most — brand-building signals.
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
// RECENCY DECAY
//
// Returns a multiplier in (0, 1] based on how old a post is.
// Uses exponential decay with a 30-day half-life:
//   multiplier = e^(-days / 30)
//
// Effect on weight contribution:
//   0 days old  → ×1.00  (full weight)
//   30 days old → ×0.72
//   60 days old → ×0.51
//   90 days old → ×0.37
//
// This means recent posts have proportionally more influence
// on rotation and hook weights than posts from months ago.
// The system adapts to audience behaviour shifts automatically.
// ─────────────────────────────────────────────────────────────

function recencyDecay(publishedAt) {
  if (!publishedAt) return 1;
  const days = (Date.now() - new Date(publishedAt).getTime()) / 86_400_000;
  return Math.exp(-days / 30);
}

// ─────────────────────────────────────────────────────────────
// RE-WEIGHT rotations by decay-adjusted historical average score
// Normalises to 30–95 range within each type group.
// ─────────────────────────────────────────────────────────────

async function reweightRotations() {
  const allScores = await redis.hgetall(SCORES_KEY);
  if (!allScores) return;

  // Weighted average using recency decay — recent posts count more
  const byRotation = {};
  for (const [, data] of Object.entries(allScores)) {
    const r      = data.rotationId;
    const score  = data.score ?? 0;
    const decay  = recencyDecay(data.publishedAt);
    if (!r) continue;
    if (!byRotation[r]) byRotation[r] = { weightedSum: 0, weightSum: 0 };
    byRotation[r].weightedSum += score * decay;
    byRotation[r].weightSum   += decay;
  }

  const averages = {};
  for (const [rotId, { weightedSum, weightSum }] of Object.entries(byRotation)) {
    if (weightSum === 0) continue;
    averages[rotId] = weightedSum / weightSum;
  }

  const maxAvg = Math.max(...Object.values(averages), 1);
  const newWeights = {};
  for (const [rotId, avg] of Object.entries(averages)) {
    newWeights[rotId] = Math.round(30 + (avg / maxAvg) * 65);
  }

  await redis.hset(WEIGHTS_KEY, newWeights);
}

// ─────────────────────────────────────────────────────────────
// RE-WEIGHT hook styles by what each one actually drives
//
// Each hook style accumulates a decay-adjusted composite signal:
//   saves    × 5  — saveable content (authority signal)
//   shares   × 4  — distribution
//   comments × 3  — conversation
//   likes    × 1  — passive engagement
//
// The system learns over time:
//   "Contrarian take"    → drives comments
//   "Technical insight"  → drives saves
//   "Story"              → drives shares
// ...and automatically favours the highest-signal openers.
//
// Normalised to 10–100 range. Requires minimum 3 data points
// per style before weight is adjusted (avoids single-post noise).
// ─────────────────────────────────────────────────────────────

async function reweightHookStyles() {
  const allScores = await redis.hgetall(SCORES_KEY);
  if (!allScores) return;

  const byHook = {};
  for (const [, data] of Object.entries(allScores)) {
    const hook  = data.hookStyle;
    const decay = recencyDecay(data.publishedAt);
    if (!hook) continue;

    const signal =
      ((data.saves    ?? 0) * 5 +
       (data.shares   ?? 0) * 4 +
       (data.comments ?? 0) * 3 +
       (data.likes    ?? 0) * 1) * decay;

    if (!byHook[hook]) byHook[hook] = { weightedSum: 0, weightSum: 0, count: 0 };
    byHook[hook].weightedSum += signal;
    byHook[hook].weightSum   += decay;
    byHook[hook].count       += 1;
  }

  // Require minimum 3 data points per style before adjusting
  const averages = {};
  for (const [hook, { weightedSum, weightSum, count }] of Object.entries(byHook)) {
    if (count < 3 || weightSum === 0) continue;
    averages[hook] = weightedSum / weightSum;
  }

  if (Object.keys(averages).length === 0) return;

  const maxAvg = Math.max(...Object.values(averages), 1);
  const hookWeights = {};
  for (const [hook, avg] of Object.entries(averages)) {
    hookWeights[hook] = {
      weight:     Math.round(10 + (avg / maxAvg) * 90),
      avgSignal:  Math.round(avg),
      dataPoints: byHook[hook].count,
      updatedAt:  new Date().toISOString(),
    };
  }

  await redis.hset(HOOK_WEIGHTS_KEY, hookWeights);
  console.log(
    "[performance] Hook weights updated:",
    Object.entries(hookWeights).map(([k, v]) => `${k}: ${v.weight}`).join(", ")
  );
}

// ─────────────────────────────────────────────────────────────
// RE-WEIGHT angles by what each one actually drives
//
// Mirrors reweightHookStyles but groups by the `angle` field
// stored on each published post record.
//
// Allows the system to learn things like:
//   "Hidden cost" angles → highest saves
//   "Common mistake" angles → highest comments
//   "Mental model" angles → highest shares
//
// Normalised to 10–100 range. Requires minimum 3 data points.
// Results stored at rebelai:angle_weights — available for
// future weighted angle selection (extend pickAngle when ready).
// ─────────────────────────────────────────────────────────────

const ANGLE_WEIGHTS_KEY = "rebelai:angle_weights";

async function reweightAngles() {
  const allScores = await redis.hgetall(SCORES_KEY);
  if (!allScores) return;

  const byAngle = {};
  for (const [, data] of Object.entries(allScores)) {
    const angle = data.angle;
    const decay = recencyDecay(data.publishedAt);
    if (!angle) continue;

    const signal =
      ((data.saves    ?? 0) * 5 +
       (data.shares   ?? 0) * 4 +
       (data.comments ?? 0) * 3 +
       (data.likes    ?? 0) * 1) * decay;

    if (!byAngle[angle]) byAngle[angle] = { weightedSum: 0, weightSum: 0, count: 0 };
    byAngle[angle].weightedSum += signal;
    byAngle[angle].weightSum   += decay;
    byAngle[angle].count       += 1;
  }

  const averages = {};
  for (const [angle, { weightedSum, weightSum, count }] of Object.entries(byAngle)) {
    if (count < 3 || weightSum === 0) continue;
    averages[angle] = weightedSum / weightSum;
  }

  if (Object.keys(averages).length === 0) return;

  const maxAvg = Math.max(...Object.values(averages), 1);
  const angleWeights = {};
  for (const [angle, avg] of Object.entries(averages)) {
    angleWeights[angle] = {
      weight:     Math.round(10 + (avg / maxAvg) * 90),
      avgSignal:  Math.round(avg),
      dataPoints: byAngle[angle].count,
      updatedAt:  new Date().toISOString(),
    };
  }

  await redis.hset(ANGLE_WEIGHTS_KEY, angleWeights);
  console.log(
    "[performance] Angle weights updated:",
    Object.entries(angleWeights).map(([k, v]) => `${k.slice(0, 30)}: ${v.weight}`).join(", ")
  );
}