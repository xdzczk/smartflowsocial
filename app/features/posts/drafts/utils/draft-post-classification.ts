/**
 * Client-side classification of draft Post rows for tabs and pickers.
 */

export interface DraftPostLike {
  postType?: string;
  postKind?: string;
  draftMeta?: unknown;
}

export function isPollDraftPost(post: DraftPostLike): boolean {
  return post.postType === "POLL";
}

export function isThreadDraftPost(post: DraftPostLike): boolean {
  if (post.postKind === "THREAD") return true;
  const meta = post.draftMeta;
  if (meta && typeof meta === "object") {
    const ts = (meta as { threadSegments?: unknown }).threadSegments;
    return Array.isArray(ts) && ts.length > 0;
  }
  return false;
}

export function isRepostDraftPost(post: DraftPostLike): boolean {
  return post.postKind === "REPOST";
}

/** Default "Posts" tab: not repost, poll, or thread-shaped draft */
export function isShortPostDraftForPostsTab(post: DraftPostLike): boolean {
  return (
    !isRepostDraftPost(post) &&
    !isPollDraftPost(post) &&
    !isThreadDraftPost(post)
  );
}
