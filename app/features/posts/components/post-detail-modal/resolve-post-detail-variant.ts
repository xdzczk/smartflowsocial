import type { SignedEvent } from "~/features/nostr/types";
import { isPollPostItem } from "~/features/polls";

import type { PostDetailModalPost } from "./post-detail-helpers";
import {
  getPostKind,
  getThreadGroupId,
  hasMediaAttachments,
} from "./post-detail-helpers";

export type PostDetailContentVariant = "text" | "media" | "poll" | "thread";
export type PostDetailHeightMode = "compact" | "medium" | "large";

function pollItemArgs(
  post: PostDetailModalPost
): Parameters<typeof isPollPostItem>[0] {
  const signedEvent = post.signedEvent as SignedEvent | undefined | null;
  return {
    type: "post",
    postType: "postType" in post ? String(post.postType) : undefined,
    signedEvent: signedEvent ?? undefined,
  };
}

export function isPostPoll(args: {
  nip88PollsEnabled: boolean;
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
}): boolean {
  const { nip88PollsEnabled, post, type } = args;
  if (!nip88PollsEnabled) return false;
  if (type === "draft") return false;
  return isPollPostItem(pollItemArgs(post));
}

export function resolveInnerContentVariant(args: {
  nip88PollsEnabled: boolean;
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
}): Exclude<PostDetailContentVariant, "thread"> {
  const { nip88PollsEnabled, post, type } = args;
  if (isPostPoll({ nip88PollsEnabled, post, type })) return "poll";
  if (hasMediaAttachments(post)) return "media";
  return "text";
}

export function resolvePostDetailVariant(args: {
  nip88PollsEnabled: boolean;
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
}): {
  variant: PostDetailContentVariant;
  heightMode: PostDetailHeightMode;
  innerVariant: Exclude<PostDetailContentVariant, "thread">;
} {
  const { nip88PollsEnabled, post, type } = args;
  const innerVariant = resolveInnerContentVariant({
    nip88PollsEnabled,
    post,
    type,
  });
  const threadGroupId = getThreadGroupId(post);
  const postKind = getPostKind(post);
  const isThreadContext = Boolean(threadGroupId) || postKind === "THREAD";

  if (isThreadContext) {
    const heightMode: PostDetailHeightMode =
      innerVariant === "media" ? "large" : "medium";
    return { variant: "thread", heightMode, innerVariant };
  }

  if (innerVariant === "poll") {
    return { variant: "poll", heightMode: "medium", innerVariant: "poll" };
  }
  if (innerVariant === "media") {
    return { variant: "media", heightMode: "large", innerVariant: "media" };
  }
  return { variant: "text", heightMode: "compact", innerVariant: "text" };
}

export function getHeaderTypeLabel(args: {
  variant: PostDetailContentVariant;
  innerVariant: Exclude<PostDetailContentVariant, "thread">;
}): string {
  if (args.variant === "thread") return "Thread post";
  if (args.innerVariant === "poll") return "Poll";
  return "Post";
}
