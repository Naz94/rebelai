// ============================================================
// REBEL ENGINE — Platform Dispatcher (lib/post.js)
//
// Handles parallel deployment to Meta (FB + IG) and LinkedIn.
// Uses Promise.allSettled so a LinkedIn outage never kills
// a Meta post, and vice versa.
//
// Public API (used by fire.js):
//   postToAllPlatforms(contentMap, imageUrl) → results[]
//
// contentMap shape:
//   { facebook: string, instagram: string, linkedin: string }
// ============================================================

import { downloadImage } from "./generate.js";

const FB_API = "https://graph.facebook.com/v19.0";
const LI_API = "https://api.linkedin.com/v2";

// ─────────────────────────────────────────────────────────────
// PUBLIC DISPATCHER
// ─────────────────────────────────────────────────────────────

/**
 * Deploy to all platforms in parallel.
 * Meta (FB + IG) runs as one group; LinkedIn runs independently.
 * If one group fails, the other still completes.
 *
 * Returns a results array:
 *   [{ platform: 'Meta',     status: 'SUCCESS'|'FAILED', data, error }]
 *   [{ platform: 'LinkedIn', status: 'SUCCESS'|'FAILED', data, error }]
 */
export async function postToAllPlatforms(contentMap, imageUrl) {
  const results = await Promise.allSettled([
    deployMeta(contentMap.facebook, contentMap.instagram, imageUrl),
    deployLinkedIn(contentMap.linkedin, imageUrl),
  ]);

  return results.map((res, i) => ({
    platform: i === 0 ? "Meta" : "LinkedIn",
    status: res.status === "fulfilled" ? "SUCCESS" : "FAILED",
    data: res.value ?? null,
    error: res.reason?.message ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────
// META DISPATCHER (Facebook + Instagram)
// ─────────────────────────────────────────────────────────────

/**
 * Sequence:
 *   1. Create IG media container IMMEDIATELY — locks in the DALL-E URL
 *      before it has any chance to expire. Container ID is permanent.
 *   2. Post to Facebook + publish the IG container in parallel.
 */
async function deployMeta(fbCopy, igCopy, imageUrl) {
  // Step A: Lock in the DALL-E URL via IG container FIRST
  const igContainerId = await createIGContainer(imageUrl, igCopy);

  // Step B: FB post + IG publish run in parallel
  const [fbResult, igResult] = await Promise.all([
    postToFacebook(imageUrl, fbCopy),
    publishIGContainer(igContainerId),
  ]);

  return { facebook: fbResult, instagram: igResult };
}

// ─────────────────────────────────────────────────────────────
// LINKEDIN DISPATCHER
// ─────────────────────────────────────────────────────────────

/**
 * LinkedIn needs a binary buffer, not a URL.
 * Downloads independently from Meta so each platform
 * gets exactly what its API requires.
 */
async function deployLinkedIn(copy, imageUrl) {
  const imageBuffer = await downloadImage(imageUrl);
  const { uploadUrl, asset } = await registerLinkedInUpload();
  await uploadImageBinary(uploadUrl, imageBuffer);
  return finalizeLinkedInPost(copy, asset);
}

// ─────────────────────────────────────────────────────────────
// HELPERS — Facebook
// ─────────────────────────────────────────────────────────────

async function postToFacebook(imageUrl, copy) {
  const res = await fetch(`${FB_API}/${process.env.FACEBOOK_PAGE_ID}/photos`, {
    method: "POST",
    body: new URLSearchParams({
      url: imageUrl,
      caption: copy,
      access_token: process.env.META_TOKEN,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Facebook error: ${JSON.stringify(data)}`);
  return { platform: "facebook", postId: data.id };
}

// ─────────────────────────────────────────────────────────────
// HELPERS — Instagram (two-step: container → publish)
// ─────────────────────────────────────────────────────────────

/**
 * Step 1: Create IG media container using the fresh DALL-E URL.
 * Call IMMEDIATELY after DALL-E returns — before anything else.
 * The container ID is permanent even after the URL expires.
 */
async function createIGContainer(imageUrl, caption) {
  const res = await fetch(`${FB_API}/${process.env.IG_USER_ID}/media`, {
    method: "POST",
    body: new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: process.env.META_TOKEN,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`IG container error: ${JSON.stringify(data)}`);
  return data.id;
}

/**
 * Step 2: Publish the pre-created container.
 * The DALL-E URL is irrelevant at this point.
 */
async function publishIGContainer(containerId) {
  const res = await fetch(`${FB_API}/${process.env.IG_USER_ID}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: process.env.META_TOKEN,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`IG publish error: ${JSON.stringify(data)}`);
  return { platform: "instagram", postId: data.id };
}

// ─────────────────────────────────────────────────────────────
// HELPERS — LinkedIn (register → upload → post)
// ─────────────────────────────────────────────────────────────

/**
 * Step 1: Register the image upload. Returns uploadUrl + asset URN.
 */
async function registerLinkedInUpload() {
  const res = await fetch(`${LI_API}/assets?action=registerUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: process.env.LINKEDIN_AUTHOR_URN,
        serviceRelationships: [{
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        }],
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn register error: ${JSON.stringify(data)}`);

  return {
    uploadUrl: data.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl,
    asset: data.value.asset,
  };
}

/**
 * Step 2: PUT the raw image binary to LinkedIn's upload URL.
 * LinkedIn returns 201 with no body on success.
 */
async function uploadImageBinary(uploadUrl, imageBuffer) {
  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: imageBuffer,
  });
}

/**
 * Step 3: Create the ugcPost referencing the uploaded asset.
 * Works for both urn:li:person and urn:li:organization URNs.
 */
async function finalizeLinkedInPost(copy, asset) {
  const res = await fetch(`${LI_API}/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: process.env.LINKEDIN_AUTHOR_URN,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: copy },
          shareMediaCategory: "IMAGE",
          media: [{
            status: "READY",
            description: { text: "Rebel Designs" },
            media: asset,
          }],
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`LinkedIn post error: ${JSON.stringify(data)}`);
  return { platform: "linkedin", postId: data.id };
}
