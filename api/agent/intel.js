// api/agent/intel.js
import { Redis } from "@upstash/redis";
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const data = (await redis.get("rebelai:intelligence_brief")) ?? null;
  return res.status(200).json(data ?? { brief: null });
}