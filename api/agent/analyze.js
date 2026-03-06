// api/agent/analyze.js
import { runPerformanceBrain } from "../../lib/performance.js";
import { requireAuth }         from "../../lib/auth.js";
export const maxDuration = 30;
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  // Accept GET (Vercel cron) or authenticated POST (dashboard)
  const isCron = req.method === "GET" && req.headers["x-vercel-cron"];
  if (!isCron && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!isCron && !requireAuth(req, res)) return;
  try {
    const result = await runPerformanceBrain();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
