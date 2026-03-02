// api/agent/leads.js — Leads CRUD for dashboard
import { getLeads, updateLeadStatus } from "../../lib/leads.js";

export default async function handler(req, res) {
  const secret = req.headers["x-agent-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== "development") {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method === "GET") {
    const leads = await getLeads();
    return res.status(200).json({ leads });
  }

  if (req.method === "POST") {
    const { commentId, status } = req.body;
    if (!commentId || !status) return res.status(400).json({ error: "commentId and status required" });
    const updated = await updateLeadStatus(commentId, status);
    return res.status(200).json({ success: true, leads: updated });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
