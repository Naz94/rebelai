// ============================================================
// REBEL AI — Drafts Queue API (api/agent/drafts.js)
// ============================================================

import { getAllDrafts } from "../../lib/drafts.js";

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const drafts  = await getAllDrafts();
  const pending = drafts.filter(d => d.status === "pending").length;

  console.log(`[drafts API] Found ${drafts.length} total, ${pending} pending`);

  return res.status(200).json({ drafts, pending });
}
