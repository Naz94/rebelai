// api/agent/debug.js
// TEMPORARY — delete after diagnosis
import { Redis } from "@upstash/redis";
import { requireAuth } from "../../lib/auth.js";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!requireAuth(req, res)) return;

  const published = (await redis.get("rebelai:published_posts")) ?? [];
  const scores    = (await redis.hgetall("rebelai:post_scores")) ?? {};

  const now = Date.now();
  const diagnosed = published.map(p => {
    const ageHours = p.publishedAt
      ? (now - new Date(p.publishedAt).getTime()) / 3_600_000
      : null;
    const alreadyScored = scores[p.postId] ?? null;
    return {
      postId:      p.postId,
      platform:    p.platform,
      rotationId:  p.rotationId,
      publishedAt: p.publishedAt ?? "MISSING",
      ageHours:    ageHours !== null ? Math.round(ageHours * 10) / 10 : "NaN — publishedAt missing",
      passesAgeGate: ageHours !== null && ageHours >= 1 && ageHours <= 336,
      alreadyFinal:  alreadyScored?.final ?? false,
      hasScore:      alreadyScored !== null,
    };
  });

  return res.status(200).json({
    totalPublished: published.length,
    totalScored:    Object.keys(scores).length,
    records: diagnosed,
  });
}
