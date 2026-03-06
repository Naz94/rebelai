// lib/drafts.js
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
  const { id: _discard, ...rest } = data;
  const draft = { ...rest, id: generateId(), status: "pending" };
  await redis.hset(DRAFTS_KEY, { [draft.id]: JSON.stringify(draft) });
  await redis.lpush(QUEUE_KEY, draft.id);
  console.log(`[drafts] Saved ${draft.id} — status: ${draft.status}`);
  return draft;
}

export async function getAllDrafts() {
  const ids = await redis.lrange(QUEUE_KEY, 0, 199);
  if (!ids || ids.length === 0) return [];
  const results = await Promise.all(ids.map(id => getDraft(id)));
  return results
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getDraft(id) {
  const raw = await redis.hget(DRAFTS_KEY, id);
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function updateDraft(id, updates) {
  const existing = await getDraft(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await redis.hset(DRAFTS_KEY, { [id]: JSON.stringify(updated) });
  return updated;
}
