// ============================================================
// REBEL AI — Platform Dispatcher (lib/post.js)
// ============================================================

const FB_API  = "https://graph.facebook.com/v19.0";
const PAGE_ID = () => process.env.FACEBOOK_PAGE_ID;
const IG_ID   = () => process.env.IG_USER_ID;
const TOKEN   = () => process.env.META_TOKEN;

export async function postToAllPlatforms(contentMap, visual) {
  const result = await deployMeta(contentMap.facebook, contentMap.instagram, visual);
  return [result];
}

async function deployMeta(fbCopy, igCopy, visual) {
  try {
    const imageUrl = visual.imageUrl;
    if (!imageUrl) throw new Error("Cannot publish: no imageUrl on draft visual");

    const [fbResult, igResult] = await Promise.allSettled([
      postToFacebook(imageUrl, fbCopy),
      postToInstagram(imageUrl, igCopy),
    ]);

    const fbData = fbResult.status === "fulfilled" ? fbResult.value : null;
    const igData = igResult.status === "fulfilled" ? igResult.value : null;

    if (fbResult.status === "rejected") {
      console.error("[post] Facebook failed:", fbResult.reason?.message);
    }
    if (igResult.status === "rejected") {
      console.error("[post] Instagram failed:", igResult.reason?.message);
    }

    const succeeded = [fbData, igData].filter(Boolean);
    const status    = succeeded.length === 2 ? "SUCCESS" : succeeded.length === 1 ? "PARTIAL" : "FAILED";

    return {
      platform: "Meta",
      status,
      data: {
        facebook:  fbData ?? { error: fbResult.reason?.message ?? "Failed" },
        instagram: igData ?? { error: igResult.reason?.message ?? "Failed" },
      },
      error: null,
    };
  } catch (err) {
    console.error("[post] Fatal:", err);
    return { platform: "Meta", status: "FAILED", data: null, error: err.message };
  }
}

// ── Download image to buffer ─────────────────────────────────

async function downloadToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ── Facebook — post photo to Page feed ──────────────────────
// Uses /{page-id}/photos with a public URL.
// Buffer/multipart uploads trigger publish_actions on some app
// configurations. URL-based posting uses pages_manage_posts only.

async function postToFacebook(imageUrl, copy) {
  const res  = await fetch(`${FB_API}/${PAGE_ID()}/photos`, {
    method: "POST",
    body:   new URLSearchParams({
      url:          imageUrl,
      caption:      copy,
      access_token: TOKEN(),
    }),
  });
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Facebook error: ${JSON.stringify(data.error ?? data)}`);
  }
  console.log("[post] Facebook success:", data.id);
  return { platform: "facebook", postId: data.id };
}

// ── Instagram — two-step container publish with polling ──────
// Step 1: create container
// Step 2: poll until status = FINISHED (up to 20 attempts)
// Step 3: publish

async function postToInstagram(imageUrl, caption) {
  // Step 1 — create media container
  const containerRes = await fetch(`${FB_API}/${IG_ID()}/media`, {
    method: "POST",
    body: new URLSearchParams({
      image_url:    imageUrl,
      caption,
      access_token: TOKEN(),
    }),
  });
  const container = await containerRes.json();

  if (!containerRes.ok || container.error) {
    throw new Error(`IG container error: ${JSON.stringify(container.error ?? container)}`);
  }

  const containerId = container.id;
  console.log("[post] Instagram container created:", containerId);

  // Step 2 — poll until container status is FINISHED
  const status = await pollContainerStatus(containerId);
  if (status !== "FINISHED") {
    throw new Error(`IG container never became ready. Final status: ${status}`);
  }

  // Step 3 — publish
  const publishRes = await fetch(`${FB_API}/${IG_ID()}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({
      creation_id:  containerId,
      access_token: TOKEN(),
    }),
  });
  const published = await publishRes.json();

  if (!publishRes.ok || published.error) {
    throw new Error(`IG publish error: ${JSON.stringify(published.error ?? published)}`);
  }
  console.log("[post] Instagram success:", published.id);
  return { platform: "instagram", postId: published.id };
}

// ── Poll Instagram container status ─────────────────────────
// Checks every 3 seconds, up to 20 attempts (60 seconds total)

async function pollContainerStatus(containerId, maxAttempts = 20, intervalMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(intervalMs);

    const res  = await fetch(
      `${FB_API}/${containerId}?fields=status_code&access_token=${TOKEN()}`
    );
    const data = await res.json();

    const status = data.status_code;
    console.log(`[post] Instagram container status (attempt ${attempt}/${maxAttempts}):`, status);

    if (status === "FINISHED") return "FINISHED";
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`IG container failed with status: ${status}`);
    }
    // IN_PROGRESS — keep polling
  }

  return "TIMEOUT";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
