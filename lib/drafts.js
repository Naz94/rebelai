// ============================================================
// REBEL AI — Draft Store (lib/drafts.js)
// ============================================================

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const DRAFTS_KEY = "rebelai:drafts";
const QUEUE_KEY  = "rebelai:queue";

function generateId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function saveDraft(data) {
  const draft = { ...data, id: generateId(), status: "pending" };
  await redis.hset(DRAFTS_KEY, { [draft.id]: JSON.stringify(draft) });
  await redis.lpush(QUEUE_KEY, draft.id);
  console.log(`[drafts] Saved draft ${draft.id} with status: ${draft.status}`);
  return draft;
}

export async function getAllDrafts() {
  const ids = await redis.lrange(QUEUE_KEY, 0, 49);
  if (!ids || ids.length === 0) return [];

  const raw = await redis.hmget(DRAFTS_KEY, ...ids);
  return raw
    .filter(Boolean)
    .map(r => typeof r === "string" ? JSON.parse(r) : r)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getDraft(id) {
  const raw = await redis.hget(DRAFTS_KEY, id);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function updateDraft(id, updates) {
  const existing = await getDraft(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await redis.hset(DRAFTS_KEY, { [id]: JSON.stringify(updated) });
  return updated;
}
