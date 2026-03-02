// api/agent/intel.js — Intelligence brief for dashboard
import { Redis } from "@upstash/redis";
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }
  const data = (await redis.get("rebel:intelligence_brief")) ?? null;
  return res.status(200).json(data ?? { brief: null });
}
