// ============================================================
// REBEL ENGINE — Analytics Router
//
// Replaces: analyze.js, perf.js, scan.js
//
// Routes via ?action= query param:
//   POST/GET ?action=analyze  — run performance brain (cron or dashboard)
//   POST/GET ?action=scan     — run lead scanner (cron or dashboard)
//   GET      ?action=perf     — return rotation weights + top posts
//   GET      (no action)      — same as perf (dashboard default)
// ============================================================

import { runPerformanceBrain, getRotationWeights } from "../../lib/performance.js";
import { runLeadScanner }                          from "../../lib/leads.js";
import { requireAuth }                             from "../../lib/auth.js";
import { Redis }                                   from "@upstash/redis";

export const maxDuration = 30;

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action  = req.query.action ?? "perf";
  const isCron  = req.headers["x-vercel-cron"] === "1";

  // ── ANALYZE — run performance brain ──────────────────────
  if (action === "analyze") {
    if (!isCron && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!isCron && !requireAuth(req, res)) return;
    try {
      const result = await runPerformanceBrain();
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── SCAN — run lead scanner ───────────────────────────────
  if (action === "scan") {
    if (!isCron && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!isCron && !requireAuth(req, res)) return;
    try {
      const result = await runLeadScanner();
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PERF — return weights + top posts (default) ───────────
  // Accepts GET only — no auth required (dashboard read)
  const [weights, scores] = await Promise.all([
    getRotationWeights(),
    redis.hgetall("rebelai:post_scores"),
  ]);

  const topPosts = scores
    ? Object.entries(scores)
        .map(([postId, data]) => ({ postId, ...data }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 10)
    : [];

  return res.status(200).json({ weights, topPosts });
}
