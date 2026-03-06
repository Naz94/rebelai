// api/agent/perf.js
import { Redis } from "@upstash/redis";
import { getRotationWeights } from "../../lib/performance.js";

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const [weights, scores] = await Promise.all([
    getRotationWeights(),
    redis.hgetall("rebelai:post_scores"),
  ]);

  const topPosts = scores
    ? Object.entries(scores).map(([postId, data]) => ({ postId, ...data })).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10)
    : [];

  return res.status(200).json({ weights, topPosts });
}