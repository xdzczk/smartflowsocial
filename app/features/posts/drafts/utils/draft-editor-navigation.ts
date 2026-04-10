/**
 * Canonical URLs to resume editing a draft in the right composer/surface.
 */

import type { ComposeContentType } from "../../composer";

import {
  isPollDraftPost,
  isThreadDraftPost,
  type DraftPostLike,
} from "./draft-post-classification";

export function getShortDraftComposeType(
  post: DraftPostLike
): ComposeContentType {
  if (isPollDraftPost(post)) return "poll";
  if (isThreadDraftPost(post)) return "thread";
  return "post";
}

export function getShortDraftComposeUrl(
  postId: string,
  post: DraftPostLike
): string {
  const type = getShortDraftComposeType(post);
  return `/dashboard/compose?type=${encodeURIComponent(type)}&mode=edit_draft&id=${encodeURIComponent(postId)}`;
}

/** Server redirect path; loader resolves poll/thread/post and redirects to compose. */
export function getShortDraftEditRedirectPath(postId: string): string {
  return `/dashboard/drafts/edit/${encodeURIComponent(postId)}`;
}

export function getLongFormDraftEditUrl(longFormPostId: string): string {
  return `/dashboard/drafts/longform/edit/${encodeURIComponent(longFormPostId)}`;
}

export function getBulkGroupUrl(groupId: string): string {
  return `/dashboard/bulkposts?groupId=${encodeURIComponent(groupId)}`;
}
