// lib/drafts.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DRAFTS_KEY = "rebelai:drafts";
const QUEUE_KEY  = "rebelai:queue";

// Max drafts kept in queue (prevents unbounded growth)
const MAX_QUEUE_SIZE = 200;

function generateId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function saveDraft(data) {
  const { id: _discard, ...rest } = data;
  const draft = { ...rest, id: generateId(), status: "pending" };

  try {
    // Store draft data and push to queue atomically where possible
    await redis.hset(DRAFTS_KEY, { [draft.id]: JSON.stringify(draft) });
    await redis.lpush(QUEUE_KEY, draft.id);

    // Trim queue to prevent unbounded growth
    await redis.ltrim(QUEUE_KEY, 0, MAX_QUEUE_SIZE - 1);

    console.log(`[drafts] Saved ${draft.id} — status: ${draft.status}`);
    return draft;
  } catch (err) {
    console.error(`[drafts] Failed to save draft ${draft.id}:`, err.message);
    throw err;
  }
}

export async function getAllDrafts() {
  try {
    const ids = await redis.lrange(QUEUE_KEY, 0, MAX_QUEUE_SIZE - 1);
    if (!ids || ids.length === 0) return [];
    const results = await Promise.all(ids.map(id => getDraft(id)));
    return results
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error("[drafts] getAllDrafts failed:", err.message);
    return [];
  }
}

export async function getDraft(id) {
  try {
    const raw = await redis.hget(DRAFTS_KEY, id);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error(`[drafts] getDraft failed for ${id}:`, err.message);
    return null;
  }
}

export async function updateDraft(id, updates) {
  try {
    const existing = await getDraft(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await redis.hset(DRAFTS_KEY, { [id]: JSON.stringify(updated) });
    return updated;
  } catch (err) {
    console.error(`[drafts] updateDraft failed for ${id}:`, err.message);
    throw err;
  }
}
