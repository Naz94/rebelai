// api/agent/scan.js
import { runLeadScanner } from "../../lib/leads.js";
export const maxDuration = 30;
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const result = await runLeadScanner();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
