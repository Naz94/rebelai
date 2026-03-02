// api/agent/analyze.js
import { runPerformanceBrain } from "../../lib/performance.js";
export const maxDuration = 30;
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const result = await runPerformanceBrain();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
