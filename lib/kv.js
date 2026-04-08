// ============================================================
// REBEL ENGINE — Redis Helpers (lib/kv.js)
// ============================================================

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ROTATION_KEY = "rebelai:rotation_index";
const TOPICS_KEY   = "rebelai:posted_topics";

// Max topics to retain in history
const MAX_TOPICS = 50;

// ─────────────────────────────────────────────────────────────
// ROTATION INDEX
// ─────────────────────────────────────────────────────────────

export async function getAndAdvanceRotation() {
  try {
    const current = (await redis.get(ROTATION_KEY)) ?? 0;
    await redis.set(ROTATION_KEY, (Number(current) + 1) % 6);
    return Number(current);
  } catch (err) {
    console.error("[kv] getAndAdvanceRotation failed:", err.message);
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// POST HISTORY
// ─────────────────────────────────────────────────────────────

export async function getPostedTopics() {
  try {
    return (await redis.get(TOPICS_KEY)) ?? [];
  } catch (err) {
    console.error("[kv] getPostedTopics failed:", err.message);
    return [];
  }
}

export async function savePostedTopic(record) {
  try {
    const topics = await getPostedTopics();
    topics.push(record);
    await redis.set(TOPICS_KEY, topics.slice(-MAX_TOPICS));
  } catch (err) {
    console.error("[kv] savePostedTopic failed:", err.message);
    // Non-fatal — post already succeeded
  }
}

// ─────────────────────────────────────────────────────────────
// MONITORING
// ─────────────────────────────────────────────────────────────

export async function saveLastRun(result) {
  try {
    await redis.set("rebelai:last_run", {
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[kv] saveLastRun failed:", err.message);
  }
}

export async function getLastRun() {
  try {
    return await redis.get("rebelai:last_run");
  } catch (err) {
    console.error("[kv] getLastRun failed:", err.message);
    return null;
  }
}
