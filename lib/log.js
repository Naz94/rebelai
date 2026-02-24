// ============================================================
// REBEL ENGINE — PAIA Section 51 Audit Logger (lib/log.js)
//
// Every post the agent makes is committed to marketing_records.json
// in the GitHub repo via Octokit. This gives you an immutable,
// version-controlled audit trail that satisfies PAIA Section 51
// requirements for automated marketing activity records.
//
// Why Octokit over raw fetch?
//   - Handles SHA retrieval, base64 encoding, and retries cleanly
//   - Typed responses — no manual header wrangling
//   - One dep already in your graph (@octokit/rest)
// ============================================================

import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
const REPO_NAME  = process.env.GITHUB_REPO_NAME;
const LOG_PATH   = "marketing_records.json";

// PAIA envelope — wraps every record in a legally descriptive structure
const PAIA_ENVELOPE = {
  source:      "Rebel Designs Content Engine v1",
  paia_section: "51",
  description: "Technical Record of Automated Marketing Activity",
};

/**
 * Append a post record to marketing_records.json in GitHub.
 *
 * If the file doesn't exist yet, it's created fresh.
 * If it exists, the new record is appended and the file is updated
 * in a single atomic commit — SHA conflict-safe.
 *
 * Non-fatal: a log failure is caught and warned so it never
 * kills a successful post.
 *
 * @param {object} record - The post record from fire.js
 */
export async function appendAuditLog(record) {
  try {
    const enrichedRecord = {
      ...record,
      timestamp: new Date().toISOString(),
      engine_v:  "1.0.0",
    };

    // ── Step 1: Get existing log file (or start fresh) ──────────
    let currentRecords = [];
    let fileSha = undefined;

    try {
      const { data: file } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo:  REPO_NAME,
        path:  LOG_PATH,
      });

      // Decode the base64 content GitHub returns
      const decoded = Buffer.from(file.content, "base64").toString("utf-8");
      const parsed  = JSON.parse(decoded);

      currentRecords = parsed.records ?? [];
      fileSha        = file.sha; // Required to update an existing file
    } catch (err) {
      if (err.status !== 404) throw err;
      // 404 = file doesn't exist yet — that's fine, we'll create it
    }

    // ── Step 2: Append new record ────────────────────────────────
    currentRecords.push(enrichedRecord);

    const updatedContent = JSON.stringify(
      { ...PAIA_ENVELOPE, records: currentRecords },
      null,
      2
    );

    // ── Step 3: Commit to GitHub ─────────────────────────────────
    await octokit.repos.createOrUpdateFileContents({
      owner:   REPO_OWNER,
      repo:    REPO_NAME,
      path:    LOG_PATH,
      message: `audit: log post ${record.id} [${record.rotation}]`,
      content: Buffer.from(updatedContent).toString("base64"),
      ...(fileSha ? { sha: fileSha } : {}), // Omit SHA for first-time creation
    });

    console.log(`[log] Audit record committed: ${record.id}`);

  } catch (err) {
    // Non-fatal — log the error but don't throw.
    // A logging failure must never roll back a successful post.
    console.error(`[log] WARN: Audit log failed for ${record.id}:`, err.message);
  }
}
