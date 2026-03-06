/**
 * Giveaway scope: resolve scope to list of posts in scope.
 * Used by loader and selection to derive eligible posts.
 */

import { prisma } from "~/lib/prisma.server";
import {
  getRecentPublishedPosts,
  getPostById,
} from "~/models/post.queries.server";
import type { PostWithQueueType } from "~/models/post.types";

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
      return getRecentPublishedPosts({
        userId,
        days,
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
      return [post as PostWithQueueType];
    }
    case "QUEUE": {
      const queue = await prisma.queueType.findFirst({
        where: { id: scope.reference.queueId, userId },
      });
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
    default: {
      const _: never = scope;
      return [];
    }
  }
}
