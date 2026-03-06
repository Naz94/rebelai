// api/agent/drafts.js — returns all drafts for dashboard
import { getAllDrafts } from "../../lib/drafts.js";
import { requireAuth }  from "../../lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-agent-secret");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAuth(req, res)) return;

  const drafts  = await getAllDrafts();
  const pending = drafts.filter(d => d.status === "pending").length;
  return res.status(200).json({ drafts, pending });
}
