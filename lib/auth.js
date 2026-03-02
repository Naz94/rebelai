/**
 * lib/auth.js - Refactored for Rebel AI
 */
export function requireAuth(req, res) {
  // Use a fallback to ensure we don't crash if one var is named differently
  const secret = process.env.CRON_SECRET || process.env.ADMIN_SECRET;

  if (!secret) {
    console.error("[auth] No secret found in environment variables (CRON_SECRET or ADMIN_SECRET)");
    // Sending a structured JSON response prevents the "Unexpected token A" frontend crash
    res.status(500).json({ 
      success: false, 
      error: "Server configuration error: Missing Secret" 
    });
    return false;
  }

  const provided = req.headers["x-agent-secret"];

  if (!provided || provided !== secret) {
    console.warn(`[auth] Unauthorized access attempt from ${req.headers['x-forwarded-for'] || 'unknown'}`);
    res.status(401).json({ 
      success: false, 
      error: "Unauthorised: Invalid Secret Provided" 
    });
    return false;
  }

  return true;
}
