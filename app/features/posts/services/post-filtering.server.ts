/**
 * Post filtering utilities
 * Centralized filtering logic for posts by queue type
 */

/**
 * Filter posts by queue type
 * @param posts Array of posts to filter
 * @param queueType Queue type name to filter by, or "all" to return all posts
 * @returns Filtered array of posts
 */
export function filterPostsByQueueType<T extends { queueType?: { name?: string | null } | null }>(
  posts: T[],
  queueType: string,
): T[] {
  if (queueType === "all") {
    return posts;
  }
  return posts.filter((post) => post.queueType?.name === queueType);
}

/**
 * Filter multiple post arrays by queue type
 * Convenience function for filtering multiple arrays at once
 */
export function filterPostsArraysByQueueType<T extends { queueType?: { name?: string | null } | null }>(config: {
  scheduledPosts?: T[];
  scheduledLongFormPosts?: T[];
  pastPosts?: T[];
  pastLongFormPosts?: T[];
  queueType: string;
}): {
  scheduledPosts: T[];
  scheduledLongFormPosts: T[];
  pastPosts: T[];
  pastLongFormPosts: T[];
} {
  const { queueType } = config;
  
  return {
    scheduledPosts: filterPostsByQueueType(config.scheduledPosts ?? [], queueType),
    scheduledLongFormPosts: filterPostsByQueueType(config.scheduledLongFormPosts ?? [], queueType),
    pastPosts: filterPostsByQueueType(config.pastPosts ?? [], queueType),
    pastLongFormPosts: filterPostsByQueueType(config.pastLongFormPosts ?? [], queueType),
  };
}
















