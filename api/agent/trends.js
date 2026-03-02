// api/agent/trends.js
import { runTrendIntelligence } from "../../lib/trends.js";
export const maxDuration = 45;
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const result = await runTrendIntelligence();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
