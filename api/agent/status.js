// api/agent/status.js
import { Redis } from "@upstash/redis";
import { getRotationWeights } from "../../lib/performance.js";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const [lastRun, published, scores, leads, postedTopics] = await Promise.all([
    redis.get("rebelai:last_run"),
    redis.get("rebelai:published_posts"),
    redis.hgetall("rebelai:post_scores"),
    redis.get("rebelai:leads"),
    redis.get("rebelai:posted_topics"),
  ]);

  const scoreValues = scores ? Object.values(scores).map(s => s.score ?? 0) : [];
  const avgScore    = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;
  const leadsList   = leads ?? [];
  const topicsList  = postedTopics ?? [];

  // Build a runId → topic record map for enriching recentPosts
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
      totalPosts:  (published ?? []).length,
      avgScore,
      leadsFound:  leadsList.length,
      hotLeads:    leadsList.filter(l => l.leadScore >= 4).length,
    },
    recentPosts,
  });
}
