/**
 * Sync Manager for PWA Foreground Sync
 * Orchestrates automatic revalidation on app resume
 */

import type { QueryClient } from "@tanstack/react-query";

type SyncState = "synced" | "syncing" | "needs_attention";

const POSTS_QUERY_KEY = "posts";
const SCHEDULED_POSTS_QUERY_KEY = "scheduled-posts";

let currentSyncState: SyncState = "synced";
let syncStateListeners: Set<(state: SyncState) => void> = new Set();

/**
 * Get current sync state
 */
export function getSyncState(): SyncState {
  return currentSyncState;
}

/**
 * Subscribe to sync state changes
 */
export function subscribeToSyncState(
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- This is an event listener pattern, not a promise callback. Callbacks are appropriate here.
  callback: (state: SyncState) => void
): () => void {
  syncStateListeners.add(callback);
  // Defer initial callback to avoid setState during render/effect setup
  // This prevents React error #418 (Cannot update a component while rendering a different component)
  setTimeout(() => {
    // eslint-disable-next-line promise/prefer-await-to-callbacks -- This is a setTimeout callback, not a promise callback. It's necessary to defer state updates and avoid React render conflicts.
    callback(currentSyncState);
  }, 0);

  // Return unsubscribe function
  return (): void => {
    syncStateListeners.delete(callback);
  };
}

/**
 * Update sync state and notify listeners
 */
function setSyncState(state: SyncState): void {
  if (currentSyncState !== state) {
    currentSyncState = state;
    const listeners = Array.from(syncStateListeners);
    for (const listener of listeners) {
      listener(state);
    }
  }
}

/**
 * Trigger foreground sync
 * Invalidates relevant queries and updates sync state
 */
export async function triggerForegroundSync(
  queryClient: QueryClient
): Promise<void> {
  setSyncState("syncing");

  try {
    // Invalidate queries that need refreshing on app resume
    await Promise.all([
      // Post-related queries
      queryClient.invalidateQueries({ queryKey: [POSTS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: [SCHEDULED_POSTS_QUERY_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["published-posts"] }),
      queryClient.invalidateQueries({ queryKey: ["post"] }),
      // Queue-related queries
      queryClient.invalidateQueries({ queryKey: ["queues"] }),
      // User-related queries (for signer status)
      queryClient.invalidateQueries({ queryKey: ["user"] }),
    ]);

    // Check if there are any posts with failures that need attention
    const postsData = queryClient.getQueryData([POSTS_QUERY_KEY]);
    const scheduledPostsData = queryClient.getQueryData([
      SCHEDULED_POSTS_QUERY_KEY,
    ]);

    // Simple check for posts that might need attention
    // This is a basic implementation - can be enhanced based on actual data structure
    const hasFailures =
      (Array.isArray(postsData) &&
        postsData.some(
          (post: unknown) =>
            typeof post === "object" &&
            post !== null &&
            "currentState" in post &&
            post.currentState === "FAILED"
        )) ||
      (Array.isArray(scheduledPostsData) &&
        scheduledPostsData.some(
          (post: unknown) =>
            typeof post === "object" &&
            post !== null &&
            "currentState" in post &&
            post.currentState === "FAILED"
        ));

    setSyncState(hasFailures ? "needs_attention" : "synced");
  } catch (error) {
    console.error("Foreground sync failed:", error);
    setSyncState("needs_attention");
  }
}

/**
 * Check for posts that need attention
 */
export function checkNeedsAttention(queryClient: QueryClient): boolean {
  const postsData = queryClient.getQueryData([POSTS_QUERY_KEY]);
  const scheduledPostsData = queryClient.getQueryData([
    SCHEDULED_POSTS_QUERY_KEY,
  ]);

  const hasFailures =
    (Array.isArray(postsData) &&
      postsData.some(
        (post: unknown) =>
          typeof post === "object" &&
          post !== null &&
          "currentState" in post &&
          post.currentState === "FAILED"
      )) ||
    (Array.isArray(scheduledPostsData) &&
      scheduledPostsData.some(
        (post: unknown) =>
          typeof post === "object" &&
          post !== null &&
          "currentState" in post &&
          post.currentState === "FAILED"
      ));

  if (hasFailures && currentSyncState !== "syncing") {
    setSyncState("needs_attention");
    return true;
  }

  return false;
}
