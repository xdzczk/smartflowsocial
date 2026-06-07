/**
 * Giveaway scope: resolve scope to list of posts in scope.
 * Used by loader and selection to derive eligible posts.
 */

import { getRecentPublishedPosts, getPostById } from "~/features/posts/server";
import type { PostWithQueueType } from "~/features/posts/server";

import {
  findQueueTypeByIdAndUser,
  findQueueTypeFullByIdAndUser,
} from "./repositories/giveaway-scope-data.server";
import type { GiveawayScope } from "./types";

/**
 * Returns published posts that fall within the given giveaway scope.
 * Used to fetch event IDs for participant fetching and selection.
 */
export async function getPostsInScope(
  userId: string,
  scope: GiveawayScope
): Promise<PostWithQueueType[]> {
  switch (scope.type) {
    case "PERIOD": {
      const ref = scope.reference;
      const days = ref.days ?? 7;
      let queueTypeId: string | undefined;
      if (ref.queueId) {
        const queue = await findQueueTypeByIdAndUser(userId, ref.queueId);
        queueTypeId = queue?.id;
      }
      return getRecentPublishedPosts({
        userId,
        days,
        queueTypeId,
        publishedFrom: ref.from,
        publishedTo: ref.to,
      });
    }
    case "SINGLE_POST": {
      const post = await getPostById({
        id: scope.reference.postId,
        userId,
      });
      if (post?.currentState !== "PUBLISHED") {
        return [];
      }
      return [post];
    }
    case "QUEUE": {
      const queue = await findQueueTypeFullByIdAndUser(
        userId,
        scope.reference.queueId
      );
      if (!queue) {
        return [];
      }
      const ref = scope.reference;
      return getRecentPublishedPosts({
        userId,
        days: ref.from && ref.to ? 0 : 30,
        queueTypeId: queue.id,
        publishedFrom: ref.from,
        publishedTo: ref.to,
      });
    }
    case "FOLLOWERS":
    case "FOLLOWING":
      return [];
    default: {
      const _: never = scope;
      return [];
    }
  }
}
