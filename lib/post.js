// ============================================================
// REBEL ENGINE — Platform Dispatcher (lib/post.js)
//
// Meta only for now (Facebook + Instagram).
// LinkedIn can be added later — see lib/linkedin.js when ready.
//
// Public API (used by fire.js):
//   postToAllPlatforms(contentMap, imageUrl) → results[]
//
// contentMap shape:
//   { facebook: string, instagram: string }
//
// Credentials (set in Vercel environment variables):
//   FACEBOOK_PAGE_ID   → 732089559987719
//   IG_USER_ID         → 17841431675756813
//   META_TOKEN         → your long-lived page access token
//                        ⚠️ expires April 25, 2026 — refresh before then
// ============================================================

const FB_API = “https://graph.facebook.com/v19.0”;

// ─────────────────────────────────────────────────────────────
// PUBLIC DISPATCHER
// ─────────────────────────────────────────────────────────────

/**

- Deploy to Facebook and Instagram.
- Returns a single result object for the Meta group.
- 
- Uses Promise.allSettled internally so if Facebook fails,
- Instagram still posts — and vice versa.
  */
  export async function postToAllPlatforms(contentMap, imageUrl) {
  const result = await deployMeta(
  contentMap.facebook,
  contentMap.instagram,
  imageUrl
  );

return [result]; // Array kept for consistency with fire.js
}

// ─────────────────────────────────────────────────────────────
// META DISPATCHER (Facebook + Instagram)
// ─────────────────────────────────────────────────────────────

/**

- Sequence:
- 1. Create IG media container IMMEDIATELY — locks in the DALL-E
- ```
   URL before it expires. Container ID is permanent.
  ```
- 1. Post to Facebook + publish IG container in parallel.
   */
   async function deployMeta(fbCopy, igCopy, imageUrl) {
   try {
   // Step A: Lock in DALL-E URL via IG container — do this FIRST
   const igContainerId = await createIGContainer(imageUrl, igCopy);

```
// Step B: FB post + IG publish in parallel
const [fbResult, igResult] = await Promise.allSettled([
  postToFacebook(imageUrl, fbCopy),
  publishIGContainer(igContainerId),
]);

return {
  platform: "Meta",
  status: "SUCCESS",
  data: {
    facebook: fbResult.status === "fulfilled" ? fbResult.value : { error: fbResult.reason?.message },
    instagram: igResult.status === "fulfilled" ? igResult.value : { error: igResult.reason?.message },
  },
  error: null,
};
```

} catch (err) {
return {
platform: “Meta”,
status: “FAILED”,
data: null,
error: err.message,
};
}
}

// ─────────────────────────────────────────────────────────────
// HELPERS — Facebook
// ─────────────────────────────────────────────────────────────

/**

- Post image + caption to the Rebel Designs Facebook Page.
- Uses the page photo endpoint — image appears in the page feed.
- 
- FACEBOOK_PAGE_ID : 732089559987719
- META_TOKEN       : long-lived page access token
  */
  async function postToFacebook(imageUrl, copy) {
  const res = await fetch(
  `${FB_API}/${process.env.FACEBOOK_PAGE_ID}/photos`,
  {
  method: “POST”,
  body: new URLSearchParams({
  url:          imageUrl,
  caption:      copy,
  access_token: process.env.META_TOKEN,
  }),
  }
  );

const data = await res.json();
if (!res.ok) throw new Error(`Facebook error: ${JSON.stringify(data)}`);
return { platform: “facebook”, postId: data.id };
}

// ─────────────────────────────────────────────────────────────
// HELPERS — Instagram (two-step: container → publish)
// ─────────────────────────────────────────────────────────────

/**

- Step 1: Create IG media container using the fresh DALL-E URL.
- 
- WHY THIS RUNS FIRST:
- DALL-E 3 image URLs expire in ~60 minutes. Instagram’s Graph API
- requires a public URL to create the media container — but once the
- container exists, it is permanent. The URL expiry no longer matters.
- Call this immediately. Never delay it.
- 
- IG_USER_ID : 17841431675756813
- META_TOKEN : same token as Facebook (page access token covers both)
  */
  async function createIGContainer(imageUrl, caption) {
  const res = await fetch(
  `${FB_API}/${process.env.IG_USER_ID}/media`,
  {
  method: “POST”,
  body: new URLSearchParams({
  image_url:    imageUrl,
  caption:      caption,
  access_token: process.env.META_TOKEN,
  }),
  }
  );

const data = await res.json();
if (!res.ok) throw new Error(`IG container error: ${JSON.stringify(data)}`);
return data.id; // Permanent container ID
}

/**

- Step 2: Publish the pre-created IG container.
- Safe to call at any point — DALL-E URL is irrelevant now.
  */
  async function publishIGContainer(containerId) {
  const res = await fetch(
  `${FB_API}/${process.env.IG_USER_ID}/media_publish`,
  {
  method: “POST”,
  body: new URLSearchParams({
  creation_id:  containerId,
  access_token: process.env.META_TOKEN,
  }),
  }
  );

const data = await res.json();
if (!res.ok) throw new Error(`IG publish error: ${JSON.stringify(data)}`);
return { platform: “instagram”, postId: data.id };
}
