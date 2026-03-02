// lib/auth.js
export function requireAuth(req, res) {
  const secret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;

  if (!secret) {
    console.error("[auth] No CRON_SECRET found in environment");
    res.status(500).json({ success: false, error: "Server config error: missing secret" });
    return false;
  }

  const provided = req.headers["x-agent-secret"];

  if (!provided || provided !== secret) {
    res.status(401).json({ success: false, error: "Unauthorised" });
    return false;
  }

  return true;
}
