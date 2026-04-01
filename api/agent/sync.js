// api/agent/sync.js
//
// Syncs ALL recent posts from Facebook Page + Instagram account
// into the analytics pipeline — including posts made manually,
// outside of the AI content engine.
//
// How it works:
//   1. Fetch recent posts from FB Page feed + IG media endpoint
//   2. Compare against already-registered post IDs in Redis
//   3. Classify each new manual post into the closest rotation
//      using GPT-4o-mini — so engagement data feeds rotation weights
//   4. Register with rotationId set — analyze.js scores them and
//      the performance brain adjusts weights as normal
//
// Trigger: authenticated POST from dashboard (no cron)

import { Redis }       from "@upstash/redis";
import OpenAI          from "openai";
import { requireAuth } from "../../lib/auth.js";
import { ROTATIONS }   from "../../lib/rotations.js";

export const maxDuration = 30;

const redis   = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
const openai  = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const FB_API  = "https://graph.facebook.com/v19.0";
const TOKEN   = () => process.env.META_TOKEN;
const PAGE_ID = () => process.env.FACEBOOK_PAGE_ID;
const IG_ID   = () => process.env.IG_USER_ID;

const PUBLISHED_KEY = "rebelai:published_posts";

// Build a compact rotation menu for the classifier prompt once at startup
const ROTATION_MENU = ROTATIONS.map(r => `${r.id}: ${r.description}`).join("\n");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res))   return;

  try {
    const [fbPosts, igPosts] = await Promise.allSettled([
      fetchFacebookPosts(),
      fetchInstagramPosts(),
    ]);

    const fbList = fbPosts.status === "fulfilled" ? fbPosts.value : [];
    const igList = igPosts.status === "fulfilled" ? igPosts.value : [];

    if (fbPosts.status === "rejected") console.error("[sync] Facebook fetch failed:", fbPosts.reason?.message);
    if (igPosts.status === "rejected") console.error("[sync] Instagram fetch failed:", igPosts.reason?.message);

    // Load existing registered posts — build a Set of known IDs for O(1) lookup
    const existing = (await redis.get(PUBLISHED_KEY)) ?? [];
    const knownIds = new Set(existing.map(p => p.postId));

    // Find posts that exist on Meta but are not yet registered
    const allFetched = [...fbList, ...igList];
    const newPosts   = allFetched.filter(p => !knownIds.has(p.postId));

    if (newPosts.length === 0) {
      console.log("[sync] No new manual posts found");
      return res.status(200).json({
        success:      true,
        synced:       0,
        alreadyKnown: allFetched.length,
        message:      "All posts already registered",
      });
    }

    // Classify each new manual post into the closest rotation
    // so its engagement data flows into the rotation weight system
    const classified = await Promise.all(
      newPosts.map(post => classifyPost(post))
    );

    // Register into published_posts
    const updated = [...existing, ...classified];
    await redis.set(PUBLISHED_KEY, updated);

    console.log(`[sync] Registered ${classified.length} new manual post(s)`);
    classified.forEach(p =>
      console.log(`  → ${p.postId} (${p.platform}) classified as: ${p.rotationId ?? "unclassified"}`)
    );

    return res.status(200).json({
      success:      true,
      synced:       classified.length,
      alreadyKnown: allFetched.length - classified.length,
      newPosts:     classified.map(p => ({
        postId:      p.postId,
        platform:    p.platform,
        publishedAt: p.publishedAt,
        rotationId:  p.rotationId,
        topic:       p.topic,
      })),
    });

  } catch (err) {
    console.error("[sync] Fatal:", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
// FACEBOOK — fetch recent Page posts (last 30 days)
// ─────────────────────────────────────────────────────────────

async function fetchFacebookPosts() {
  const since = Math.floor((Date.now() - 30 * 24 * 3_600_000) / 1000);

  const url  = `${FB_API}/${PAGE_ID()}/feed?fields=id,created_time,message&since=${since}&limit=50&access_token=${TOKEN()}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Facebook feed error: ${JSON.stringify(data.error ?? data)}`);
  }

  return (data.data ?? []).map(post => ({
    postId:      post.id,
    platform:    "facebook",
    source:      "manual",
    publishedAt: post.created_time,
    runId:       null,
    hookStyle:   null,
    angle:       null,
    caption:     post.message ?? "",
    topic:       post.message?.split("\n")[0]?.slice(0, 80) ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────
// INSTAGRAM — fetch recent media (last 30 days)
// ─────────────────────────────────────────────────────────────

async function fetchInstagramPosts() {
  const url  = `${FB_API}/${IG_ID()}/media?fields=id,timestamp,caption,media_type&limit=50&access_token=${TOKEN()}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Instagram media error: ${JSON.stringify(data.error ?? data)}`);
  }

  const cutoff = Date.now() - 30 * 24 * 3_600_000;

  return (data.data ?? [])
    .filter(post => new Date(post.timestamp).getTime() > cutoff)
    .map(post => ({
      postId:      post.id,
      platform:    "instagram",
      source:      "manual",
      publishedAt: post.timestamp,
      runId:       null,
      hookStyle:   null,
      angle:       null,
      caption:     post.caption ?? "",
      topic:       post.caption?.split("\n")[0]?.slice(0, 80) ?? null,
    }));
}

// ─────────────────────────────────────────────────────────────
// CLASSIFY POST INTO ROTATION
//
// Uses GPT-4o-mini to read the post caption and pick the closest
// rotation from the ROTATIONS list. This is what allows manual
// post engagement to feed into the rotation weight system —
// a high-performing manual CSS post will boost value_css weight
// exactly the same as an AI-published one would.
//
// Falls back to null rotationId if classification fails or if
// OpenAI is unavailable — post still gets registered and scored,
// it just won't shift rotation weights.
// ─────────────────────────────────────────────────────────────

async function classifyPost(post) {
  // No caption to classify, or no OpenAI — register without rotationId
  if (!post.caption || !openai) {
    return { ...post, rotationId: null };
  }

  try {
    const response = await openai.chat.completions.create({
      model:      "gpt-4o-mini",
      max_tokens: 20,
      messages: [{
        role:    "user",
        content: `You are classifying a social media post for a web development studio into one of these content categories.

CATEGORIES:
${ROTATION_MENU}

POST CAPTION:
${post.caption.slice(0, 600)}

Reply with ONLY the category ID that best matches this post. Nothing else. No explanation.
If no category fits at all, reply with: unclassified`,
      }],
    });

    const raw        = response.choices[0].message.content?.trim() ?? "";
    const rotationId = ROTATIONS.find(r => r.id === raw) ? raw : null;

    if (!rotationId) {
      console.warn(`[sync] Could not classify post ${post.postId} — model returned: "${raw}"`);
    }

    return { ...post, rotationId };

  } catch (err) {
    console.warn(`[sync] Classification failed for ${post.postId}:`, err.message);
    return { ...post, rotationId: null };
  }
}
