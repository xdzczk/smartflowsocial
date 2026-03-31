/**
 * Resolve the user's Post row when a lookup event id matches nostrEventId,
 * for schedule repost/quote (same as Published page).
 */

import { getPostById } from "~/features/posts/server";
import type { PostData } from "~/features/posts/types";
import { convertPrismaQueueTypeToQueueType } from "~/features/posts/types";
import {
  validateNostrEvent,
  validateSignedEvent,
} from "~/lib/validation/nostr-events.server";

import { findPostByNostrEventId } from "../repositories/global-search-data.server";

function mapPrismaPostToPostData(
  post: NonNullable<Awaited<ReturnType<typeof getPostById>>>
): PostData {
  const signedEventValue = validateSignedEvent(post.signedEvent);
  const nostrEventValue = validateNostrEvent(post.nostrEvent);
  return {
    ...post,
    queueType: convertPrismaQueueTypeToQueueType(post.queueType),
    signedEvent: signedEventValue,
    nostrEvent: nostrEventValue,
  };
}

export async function loadScheduleSourcePostForUserEvent(
  userId: string,
  eventIdHex: string | undefined
): Promise<PostData | null> {
  if (!eventIdHex) return null;
  const row = await findPostByNostrEventId(userId, eventIdHex);
  if (!row) return null;
  const full = await getPostById({ id: row.id, userId });
  if (!full) return null;
  return mapPrismaPostToPostData(full);
}
