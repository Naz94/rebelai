// ============================================================
// REBEL AI — Platform Dispatcher (lib/post.js)
// ============================================================

import { put } from "@vercel/blob";

const FB_API  = "https://graph.facebook.com/v19.0";
const PAGE_ID = () => process.env.FACEBOOK_PAGE_ID;
const IG_ID   = () => process.env.IG_USER_ID;
const TOKEN   = () => process.env.META_TOKEN;

const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, label, retries = MAX_RETRIES) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[post] ${label} attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr;
}

export async function postToAllPlatforms(contentMap, visual) {
  const result = await deployMeta(contentMap.facebook, contentMap.instagram, visual);
  return [result];
}

async function deployMeta(fbCopy, igCopy, visual) {
  try {
    // ── Resolve image buffer ─────────────────────────────────
    const imageBuffer = await resolveImageBuffer(visual);

    // ── Resolve public URL for Instagram ────────────────────
    // Instagram requires a publicly accessible URL.
    // Priority: existing imageUrl → upload buffer to Blob → fail gracefully
    const igUrl = await resolveInstagramUrl(visual, imageBuffer);

    const [fbResult, igResult] = await Promise.allSettled([
      withRetry(() => postToFacebook(imageBuffer, fbCopy), "Facebook"),
      igUrl
        ? withRetry(() => postToInstagram(igUrl, igCopy), "Instagram")
        : Promise.reject(new Error("Instagram skipped: could not obtain a public image URL")),
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

// ── Resolve image buffer ─────────────────────────────────────
// Tries imageUrl first. Falls back to base64 buffer on the draft.

async function resolveImageBuffer(visual) {
  if (visual?.imageUrl) {
    try {
      return await downloadToBuffer(visual.imageUrl);
    } catch (err) {
      console.warn("[post] imageUrl fetch failed, trying buffer fallback:", err.message);
    }
  }

  if (visual?.buffer) {
    console.log("[post] Using base64 buffer from draft");
    return Buffer.from(visual.buffer, "base64");
  }

  throw new Error("Cannot publish: no imageUrl and no buffer available on draft visual");
}

// ── Resolve Instagram public URL ─────────────────────────────
// Instagram requires a public URL — it cannot accept a raw buffer.
// If we only have a buffer (caption upload without imageUrl),
// upload it to Vercel Blob to get a permanent public URL.

async function resolveInstagramUrl(visual, imageBuffer) {
  // Already have a URL
  if (visual?.imageUrl) return visual.imageUrl;

  // No URL but have buffer — upload to Blob
  if (imageBuffer) {
    try {
      console.log("[post] No imageUrl for Instagram — uploading buffer to Blob");
      const filename = `rebelai/visuals/ig-upload-${Date.now()}.png`;
      const mimeType = visual?.mimeType ?? "image/jpeg";
      const { url } = await put(filename, imageBuffer, {
        access:      "public",
        contentType: mimeType,
      });
      console.log("[post] Buffer uploaded to Blob for Instagram:", url);
      return url;
    } catch (err) {
      console.error("[post] Blob upload for Instagram failed:", err.message);
      return null;
    }
  }

  return null;
}

// ── Download image to buffer ─────────────────────────────────

async function downloadToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ── Facebook — post photo to Page feed ──────────────────────

async function postToFacebook(buffer, copy) {
  const form = new FormData();
  form.append("source",       new Blob([buffer], { type: "image/png" }), "post.png");
  form.append("caption",      copy);
  form.append("access_token", TOKEN());

  const res  = await fetch(`${FB_API}/${PAGE_ID()}/photos`, { method: "POST", body: form });
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(`Facebook error: ${JSON.stringify(data.error ?? data)}`);
  }
  console.log("[post] Facebook success:", data.id);
  return { platform: "facebook", postId: data.id };
}

// ── Instagram — two-step container publish with polling ──────

async function postToInstagram(imageUrl, caption) {
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

  const status = await pollContainerStatus(containerId);
  if (status !== "FINISHED") {
    throw new Error(`IG container never became ready. Final status: ${status}`);
  }

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
  }
  return "TIMEOUT";
}
