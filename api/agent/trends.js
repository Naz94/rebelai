// api/agent/trends.js — Cron: "0 6 * * *"
import { runTrendIntelligence } from "../../lib/trends.js";
export const maxDuration = 45;
export default async function handler(req, res) {
  const secret = req.headers["x-vercel-cron-secret"] ?? req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }
  try {
    const result = await runTrendIntelligence();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("[trends] Fatal:", err);
    return res.status(500).json({ error: err.message });
  }
}
