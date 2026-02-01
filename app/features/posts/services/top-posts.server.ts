/**
 * Top posts by engagement for dashboard
 */

import {
  validateSignedEvent,
  validateNostrEvent,
} from "~/lib/validation/nostr-events.server";
import { getRecentPostedPosts } from "~/models/post.queries.server";
import type { PostWithQueueType } from "~/models/post.types";

import { toPostDTO, type PostDTO } from "../dtos";
import type { PostStats } from "../stats.server";
import { getPostStats } from "../stats.server";
import type { PostData } from "../types";
import { convertPrismaQueueTypeToQueueType } from "../types";

export interface TopPostItem {
  post: PostDTO;
  stats: PostStats;
}

export interface GetTopPostedPostsParams {
  userId: string;
  days?: number;
  limit?: number;
}

const DEFAULT_DAYS = 7;
const DEFAULT_LIMIT = 5;

function engagementScore(stats: PostStats): number {
  return stats.likes + stats.replies + stats.zaps;
}

function getEventId(post: PostWithQueueType): string {
  const signed = post.signedEvent as { id?: string } | null | undefined;
  return signed?.id ?? post.id;
}

function toPostData(post: PostWithQueueType): PostData {
  const { queueType, ...rest } = post;
  const signedEventValue = validateSignedEvent(post.signedEvent);
  const nostrEventValue = validateNostrEvent(post.nostrEvent);
  const convertedQueueType = convertPrismaQueueTypeToQueueType(queueType);
  const result: PostData = {
    ...rest,
    queueType: convertedQueueType,
    signedEvent: signedEventValue,
    nostrEvent: nostrEventValue,
  };
  return result;
}

export async function getTopPostedPostsByEngagement({
  userId,
  days = DEFAULT_DAYS,
  limit = DEFAULT_LIMIT,
}: GetTopPostedPostsParams): Promise<{
  topPosts: TopPostItem[];
  timeframeDays: number;
}> {
  const posts = await getRecentPostedPosts({ userId, days });
  if (posts.length === 0) {
    return { topPosts: [], timeframeDays: days };
  }

  const eventIds = posts.map((post) => getEventId(post));
  const stats = await getPostStats(eventIds);

  const withScore = posts.map((post) => {
    const eventId = getEventId(post);
    const postStats = stats[eventId] ?? {
      likes: 0,
      replies: 0,
      mentions: 0,
      reposts: 0,
      zaps: 0,
      satszapped: 0,
    };
    return { post, stats: postStats, score: engagementScore(postStats) };
  });

  withScore.sort((a, b) => b.score - a.score);
  const top = withScore.slice(0, limit);

  const topPosts: TopPostItem[] = top.map(({ post, stats: postStats }) => ({
    post: toPostDTO(toPostData(post)),
    stats: postStats,
  }));

  return { topPosts, timeframeDays: days };
}
