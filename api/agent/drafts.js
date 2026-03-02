// ============================================================
// REBEL ENGINE — Drafts Queue API (api/agent/drafts.js)
// GET → returns all drafts for dashboard display
// ============================================================

import { getAllDrafts } from "../../lib/drafts.js";

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const drafts  = await getAllDrafts();
  const pending = drafts.filter(d => d.status === "pending").length;

  return res.status(200).json({ drafts, pending });
}
