// api/agent/status.js — Aggregates all data for dashboard overview tab
import { Redis } from "@upstash/redis";
import { getRotationWeights } from "../../lib/performance.js";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const [lastRun, published, scores, leads, pending] = await Promise.all([
    redis.get("rebelai:last_run"),
    redis.get("rebelai:published_posts"),
    redis.hgetall("rebelai:post_scores"),
    redis.get("rebelai:leads"),
    redis.get("rebelai:pending_replies"),
  ]);

  const scoreValues = scores ? Object.values(scores).map(s => s.score ?? 0) : [];
  const avgScore    = scoreValues.length ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) : null;
  const leadsList   = leads ?? [];
  const pubList     = (published ?? []).slice(-10).reverse();

  return res.status(200).json({
    lastRun,
    metrics: {
      totalPosts:     (published ?? []).length,
      avgScore,
      leadsFound:     leadsList.length,
      hotLeads:       leadsList.filter(l => l.leadScore >= 4).length,
      pendingReplies: (pending ?? []).length,
    },
    recentPosts: pubList.map(p => ({
      ...p,
      score: scores?.[p.postId]?.score ?? null,
    })),
  });
}
