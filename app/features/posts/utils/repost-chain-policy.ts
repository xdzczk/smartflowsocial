/**
 * Rules for chaining Nostr reposts/quotes: do not allow reposting or quoting a pure repost (kind 6 / REPOST).
 */

export function isPureRepostSourcePost(post: {
  postKind?: string | null;
  repost?: boolean | null;
  isQuotedPost?: boolean | null;
}): boolean {
  if (post.isQuotedPost) return false;
  if (post.postKind === "REPOST") return true;
  return post.repost === true;
}
