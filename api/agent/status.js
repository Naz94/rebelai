// api/agent/status.js
import { Redis }             from "@upstash/redis";
import { getRotationWeights } from "../../lib/performance.js";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const FB_API  = "https://graph.facebook.com/v19.0";
const TOKEN   = () => process.env.META_TOKEN;
const PAGE_ID = () => process.env.FACEBOOK_PAGE_ID;
const IG_ID   = () => process.env.IG_USER_ID;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();

  const [lastRun, published, scores, leads, postedTopics, metaFeed] = await Promise.all([
    redis.get("rebelai:last_run"),
    redis.get("rebelai:published_posts"),
    redis.hgetall("rebelai:post_scores"),
    redis.get("rebelai:leads"),
    redis.get("rebelai:posted_topics"),
    fetchMetaFeed(),
  ]);

  const scoreValues = scores ? Object.values(scores).map(s => s.score ?? 0) : [];
  const avgScore    = scoreValues.length
    ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
    : null;

  const leadsList  = leads ?? [];
  const topicsList = postedTopics ?? [];

  const topicByRunId = {};
  for (const t of topicsList) {
    if (t.runId) topicByRunId[t.runId] = t;
  }

  const recentPosts = (published ?? []).slice(-10).reverse().map(p => ({
    ...p,
    topic:    topicByRunId[p.runId]?.topic    ?? null,
    rotation: topicByRunId[p.runId]?.rotation ?? null,
    score:    scores?.[p.postId]?.score       ?? null,
  }));

  return res.status(200).json({
    lastRun,
    metrics: {
      totalPosts: (published ?? []).length,
      avgScore,
      leadsFound: leadsList.length,
      hotLeads:   leadsList.filter(l => l.leadScore >= 4).length,
    },
    recentPosts,
    metaFeed,
  });
}

// ─────────────────────────────────────────────────────────────
// FETCH LIVE META FEED
// Pulls last 20 posts from Facebook Page + Instagram.
// Returns top 10 by total engagement (likes + comments).
// Gracefully returns empty arrays if tokens are missing or calls fail.
// ─────────────────────────────────────────────────────────────

async function fetchMetaFeed() {
  if (!TOKEN() || !PAGE_ID() || !IG_ID()) {
    return { facebook: [], instagram: [], topPerformers: [] };
  }

  const [fbResult, igResult] = await Promise.allSettled([
    fetchFacebookPosts(),
    fetchInstagramPosts(),
  ]);

  const facebook  = fbResult.status  === "fulfilled" ? fbResult.value  : [];
  const instagram = igResult.status  === "fulfilled" ? igResult.value  : [];

  if (fbResult.status  === "rejected") console.error("[status] FB feed failed:", fbResult.reason?.message);
  if (igResult.status  === "rejected") console.error("[status] IG feed failed:", igResult.reason?.message);

  // Merge and sort by engagement descending — top 6 shown in dashboard
  const all = [...facebook, ...instagram].sort(
    (a, b) => (b.likes + b.comments) - (a.likes + a.comments)
  );

  return {
    facebook,
    instagram,
    topPerformers: all.slice(0, 6),
  };
}

async function fetchFacebookPosts() {
  const url  = `${FB_API}/${PAGE_ID()}/feed?fields=id,created_time,message,full_picture,likes.summary(true),comments.summary(true)&limit=20&access_token=${TOKEN()}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) throw new Error(JSON.stringify(data.error ?? { status: res.status }));

  return (data.data ?? []).map(p => ({
    postId:    p.id,
    platform:  "facebook",
    caption:   p.message ?? "",
    imageUrl:  p.full_picture ?? null,
    likes:     p.likes?.summary?.total_count    ?? 0,
    comments:  p.comments?.summary?.total_count ?? 0,
    createdAt: p.created_time,
  }));
}

async function fetchInstagramPosts() {
  const url  = `${FB_API}/${IG_ID()}/media?fields=id,timestamp,caption,media_url,thumbnail_url,media_type,like_count,comments_count&limit=20&access_token=${TOKEN()}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) throw new Error(JSON.stringify(data.error ?? { status: res.status }));

  return (data.data ?? []).map(p => ({
    postId:    p.id,
    platform:  "instagram",
    caption:   p.caption ?? "",
    imageUrl:  p.media_url ?? p.thumbnail_url ?? null,
    likes:     p.like_count     ?? 0,
    comments:  p.comments_count ?? 0,
    createdAt: p.timestamp,
    mediaType: p.media_type,
  }));
}
