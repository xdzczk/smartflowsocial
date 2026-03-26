/**
 * Determine if a post is a regular post or longform post
 * Returns "post" for regular posts, "longform" for longform posts
 */
export function getPostTypeFromPost(
  post: { id: string } | null,
  longFormPost: { id: string } | null
): "post" | "longform" {
  if (longFormPost) {
    return "longform";
  }
  if (post) {
    return "post";
  }
  // Default to post if neither is found
  return "post";
}

/**
 * Generate URL for "create new post" based on post type
 */
export function getNewPostUrl(postType: "post" | "longform"): string {
  if (postType === "longform") {
    return "/dashboard/compose/article";
  }
  return "/dashboard/compose?type=post";
}

/**
 * Determine if the action was publish or schedule based on post state
 */
export function determineModalAction(
  post: { currentState?: string | null } | null,
  longFormPost: { currentState?: string | null } | null
): "publish" | "schedule" {
  const currentState = post?.currentState ?? longFormPost?.currentState ?? null;

  // If state is PUBLISHED, it was published
  if (currentState === "PUBLISHED") {
    return "publish";
  }

  // If state is SCHEDULED, it was scheduled
  if (currentState === "SCHEDULED") {
    return "schedule";
  }

  // Default to schedule for safety (scheduled posts are more common)
  return "schedule";
}

/**
 * Format relay URL for display (remove protocol, truncate if needed)
 */
export function formatRelayUrl(relayUrl: string): string {
  try {
    const url = new URL(relayUrl);
    let display = url.hostname;
    if (url.port && url.port !== "443" && url.port !== "80") {
      display += `:${url.port}`;
    }
    return display;
  } catch {
    // If URL parsing fails, return as-is (truncated if too long)
    return relayUrl.length > 50 ? `${relayUrl.slice(0, 47)}...` : relayUrl;
  }
}
