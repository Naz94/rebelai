// api/agent/leads.js
import { getLeads, updateLeadStatus } from "../../lib/leads.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET") {
    const leads = await getLeads();
    return res.status(200).json({ leads });
  }
  if (req.method === "POST") {
    const { commentId, status } = req.body;
    const updated = await updateLeadStatus(commentId, status);
    return res.status(200).json({ success: true, leads: updated });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
