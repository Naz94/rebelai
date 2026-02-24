// ============================================================
// REBEL DESIGNS — Resource Snapshot
//
// PRO-TIP #3 FIX: Anti-Hallucination Resource Feed
//
// Claude receives a verified snapshot of what actually exists on
// rebeldesigns.co.za before generating any copy. This prevents
// it from inventing tool names, wrong URLs, or outdated descriptions.
//
// Two-tier approach:
//   1. PRIMARY: Fetch live from rebeldesigns.co.za/api/resources-summary
//      (Add this endpoint to your site — returns JSON of current tools)
//   2. FALLBACK: Hardcoded snapshot below — always accurate, update
//      this whenever you add or remove a lab tool or resource.
//
// To add the live endpoint to your site, create a simple API route
// that returns the FALLBACK_SNAPSHOT structure below as JSON.
// ============================================================

const FALLBACK_SNAPSHOT = {
  source: "hardcoded-fallback",
  lastUpdated: "2026-02-25",
  labTools: [
    {
      name: "Password Roast",
      description: "Rates password strength with brutal, witty commentary. Checks entropy, common patterns, and dictionary hits.",
      url: "https://rebeldesigns.co.za/lab/password-roast",
    },
    {
      name: "Rebel T-T-T",
      description: "A precision-designed tic-tac-toe game demonstrating UI craft, smooth state management, and micro-interactions.",
      url: "https://rebeldesigns.co.za/lab/ttt",
    },
    // Add new lab tools here as you build them:
    // {
    //   name: "Tool Name",
    //   description: "What it does.",
    //   url: "https://rebeldesigns.co.za/lab/tool-slug",
    // },
  ],
  resourceTypes: [
    "HTML/CSS Snippets",
    "JavaScript Patterns",
    "Shopify Hydrogen Templates",
    "WordPress Custom Block Starters",
    "POPIA Compliance Checklists",
    "Web Performance Auditing Guides",
  ],
  siteLinks: {
    lab: "https://rebeldesigns.co.za/lab",
    resources: "https://rebeldesigns.co.za/resources",
    contact: "https://rebeldesigns.co.za/contact",
    home: "https://rebeldesigns.co.za",
  },
};

/**
 * Fetch the current resource snapshot.
 *
 * Tries to get a live version from your site's API endpoint first.
 * Falls back to the hardcoded snapshot if the fetch fails or times out.
 * This means the agent never breaks even if your site is down.
 */
export async function fetchResourceSnapshot() {
  // If you've added /api/resources-summary to your site, set this env var:
  const liveUrl = process.env.RESOURCES_SUMMARY_URL;

  if (liveUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(liveUrl, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return { ...data, source: "live-api" };
      }
    } catch {
      // Fetch failed or timed out — fall through to hardcoded snapshot
      console.warn("[resources] Live fetch failed, using hardcoded fallback.");
    }
  }

  return FALLBACK_SNAPSHOT;
}
