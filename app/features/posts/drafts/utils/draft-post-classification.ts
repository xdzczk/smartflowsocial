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

/** Draft row linked as a queue follow-up under another draft/parent (nested in UI). */
export interface DraftPostDependencyFields extends DraftPostLike {
  parentScheduledActionId?: string | null;
  dependencyMode?: string | null;
}

export function isAttachedFollowUpDraftPost(
  post: DraftPostDependencyFields
): boolean {
  const pid = post.parentScheduledActionId;
  if (pid == null || pid === "") return false;
  return post.dependencyMode !== "standalone";
}

export function isStandaloneRepostDraftPost(
  post: DraftPostDependencyFields
): boolean {
  return isRepostDraftPost(post) && !isAttachedFollowUpDraftPost(post);
}

/** Default "Posts" tab: not repost, poll, or thread-shaped draft */
export function isShortPostDraftForPostsTab(
  post: DraftPostLike & Partial<DraftPostDependencyFields>
): boolean {
  return (
    !isAttachedFollowUpDraftPost(post) &&
    !isRepostDraftPost(post) &&
    !isPollDraftPost(post) &&
    !isThreadDraftPost(post)
  );
}
