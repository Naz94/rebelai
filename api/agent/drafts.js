// api/agent/drafts.js
import { getAllDrafts } from "../../lib/drafts.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const drafts  = await getAllDrafts();
  const pending = drafts.filter(d => d.status === "pending").length;

  return res.status(200).json({ drafts, pending });
}
