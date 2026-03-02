// api/agent/perf.js — Performance data for dashboard
import { Redis } from "@upstash/redis";
import { getRotationWeights } from "../../lib/performance.js";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const [weights, scores] = await Promise.all([
    getRotationWeights(),
    redis.hgetall("rebel:post_scores"),
  ]);

  const topPosts = scores
    ? Object.entries(scores)
        .map(([postId, data]) => ({ postId, ...data }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 10)
    : [];

  return res.status(200).json({ weights, topPosts });
}
