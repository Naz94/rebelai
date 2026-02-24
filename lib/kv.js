// ============================================================
// REBEL ENGINE — Redis Helpers (lib/kv.js)
//
// Uses Upstash Redis (the replacement for deprecated @vercel/kv).
// Add via Vercel Marketplace: vercel.com/marketplace → search Redis → Upstash
// Upstash auto-adds UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// to your Vercel environment variables.
// ============================================================

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ROTATION_KEY = "rebel:rotation_index";
const TOPICS_KEY   = "rebel:posted_topics";

/**
 * Get the current rotation index and advance it for next time.
 */
export async function getAndAdvanceRotation() {
  const current = (await redis.get(ROTATION_KEY)) ?? 0;
  await redis.set(ROTATION_KEY, (current + 1) % 4);
  return current;
}

/**
 * Get the list of previously used topics (to avoid repetition).
 */
export async function getPostedTopics() {
  return (await redis.get(TOPICS_KEY)) ?? [];
}

/**
 * Save a new topic to the posted topics list.
 */
export async function savePostedTopic(topic) {
  const topics = await getPostedTopics();
  topics.push({ topic, date: new Date().toISOString() });
  // Keep last 50 topics max
  const trimmed = topics.slice(-50);
  await redis.set(TOPICS_KEY, trimmed);
}

/**
 * Store the last run result for dashboard monitoring.
 */
export async function saveLastRun(result) {
  await redis.set("rebel:last_run", { ...result, timestamp: new Date().toISOString() });
}

/**
 * Get the last run result (for monitoring).
 */
export async function getLastRun() {
  return await redis.get("rebel:last_run");
}
