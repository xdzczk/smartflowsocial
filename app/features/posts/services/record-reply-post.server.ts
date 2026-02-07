/**
 * Record a published reply as a Post (postKind REPLY) so it appears in Posted.
 * Used by the API publish route after a kind-1 reply is successfully published to relays.
 */

import type { SignedEvent } from "~/features/nostr/types";
import { createPostWithOutbox } from "~/models/post.commands.server";

import { PostStateMachine } from "../state-machine/post-state-machine.server";

export interface RecordReplyPostParams {
  userId: string;
  signedEvent: SignedEvent;
  replyToEventId: string;
  replyToPostId?: string | null;
}

/**
 * Creates a Post with postKind REPLY and transitions it to PUBLISHED.
 * Call after the reply event has been published to relays.
 */
export async function recordReplyPost(
  params: RecordReplyPostParams
): Promise<{ postId: string }> {
  const { userId, signedEvent, replyToEventId, replyToPostId } = params;

  const post = await createPostWithOutbox({
    userId,
    content: signedEvent.content,
    caption: signedEvent.content,
    fileUrl: [],
    postType: "TEXT",
    tags: signedEvent.tags.map((t) =>
      Array.isArray(t) ? t.join(",") : String(t)
    ),
    postKind: "REPLY",
    replyToEventId,
    ...(replyToPostId && replyToPostId !== "" && { replyToPostId }),
    signedEvent,
    nostrEventId: signedEvent.id,
    postedAt: new Date(),
  });

  const stateMachine = new PostStateMachine();
  await stateMachine.transition(
    post.id,
    userId,
    "PUBLISHED",
    "Reply published via API"
  );

  return { postId: post.id };
}
