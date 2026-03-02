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
    // Download image buffer first — DALL-E URLs expire in ~60 mins
    // Both FB and IG get the buffer uploaded directly, not via URL
    const imageBuffer = await downloadToBuffer(visual.imageUrl);

    const [fbResult, igResult] = await Promise.allSettled([
      postToFacebook(imageBuffer, fbCopy),
      postToInstagram(visual.imageUrl, igCopy),
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
        facebook:  fbData  ?? { error: fbResult.reason?.message ?? "Failed" },
        instagram: igData  ?? { error: igResult.reason?.message ?? "Failed" },
      },
      error: null,
    };
  } catch (err) {
    console.error("[post] Fatal:", err);
    return { platform: "Meta", status: "FAILED", data: null, error: err.message };
  }
}

// ── Download image to buffer ──────────────────────────────

async function downloadToBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

// ── Facebook — upload buffer directly ────────────────────

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

// ── Instagram — two-step container publish ────────────────

async function postToInstagram(imageUrl, caption) {
  // Step 1: create container
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

  // Step 2: publish container
  const publishRes = await fetch(`${FB_API}/${IG_ID()}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({
      creation_id:  container.id,
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
