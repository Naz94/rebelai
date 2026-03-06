// api/agent/recover.js
// ONE-TIME USE: Re-syncs the queue list from the drafts hash.
// Run this if the queue shows 0 but you know drafts exist.
// Call: POST /api/agent/recover (with x-agent-secret header)

import { Redis } from "@upstash/redis";
import { requireAuth } from "../../lib/auth.js";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DRAFTS_KEY = "rebelai:drafts";
const QUEUE_KEY  = "rebelai:queue";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "POST only" });
  if (!requireAuth(req, res))   return;

  try {
    // Get all draft IDs from the hash
    const allFields = await redis.hkeys(DRAFTS_KEY);
    if (!allFields || allFields.length === 0) {
      return res.status(200).json({ message: "No drafts found in hash — nothing to recover", recovered: 0 });
    }

    // Get existing queue IDs to avoid duplicates
    const existingQueue = new Set(await redis.lrange(QUEUE_KEY, 0, -1));

    // Find IDs in hash but not in queue
    const missing = allFields.filter(id => !existingQueue.has(id));

    if (missing.length === 0) {
      return res.status(200).json({
        message: "Queue is already in sync",
        totalDrafts: allFields.length,
        recovered: 0,
      });
    }

    // Add missing IDs to the front of the queue
    for (const id of missing) {
      await redis.lpush(QUEUE_KEY, id);
    }

    return res.status(200).json({
      message: `Recovered ${missing.length} draft(s) into queue`,
      totalDrafts: allFields.length,
      recovered: missing.length,
      recoveredIds: missing,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}