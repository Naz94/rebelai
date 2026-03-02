// ============================================================
// REBEL ENGINE — Auth Middleware (lib/auth.js)
// ============================================================

/**
 * Validates the x-agent-secret header against CRON_SECRET env var.
 * Returns true if authorised, false otherwise.
 *
 * Usage in any API handler:
 *   import { requireAuth } from "../../lib/auth.js";
 *   if (!requireAuth(req, res)) return;
 */
export function requireAuth(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[auth] CRON_SECRET env var is not set — all requests blocked");
    res.status(500).json({ error: "Server misconfigured: CRON_SECRET not set" });
    return false;
  }

  const provided = req.headers["x-agent-secret"];
  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Unauthorised" });
    return false;
  }

  return true;
}
